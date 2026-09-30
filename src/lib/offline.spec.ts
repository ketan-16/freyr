import { stringify } from 'devalue';
import { describe, expect, it } from 'vitest';
import {
	dataKey,
	describeWrite,
	failureMessage,
	judge,
	layoutData,
	mergeData,
	queueable,
	toSyncItem,
	type QueuedWrite
} from './offline';

const layout = { type: 'data', data: [{ user: 1 }, 'me'], uses: {} };
const page = (n: number) => ({ type: 'data', data: [{ n: 1 }, n], uses: { url: 1 } });
const body = (nodes: unknown[]) => JSON.stringify({ type: 'data', nodes });

describe('queueable', () => {
	it('queues form actions and the theme, never signing in or out', () => {
		expect(queueable('/ledger', true)).toBe(true);
		expect(queueable('/settings/categories', true)).toBe(true);
		expect(queueable('/theme', false)).toBe(true);
		expect(queueable('/login', true)).toBe(false);
		expect(queueable('/setup', true)).toBe(false);
		expect(queueable('/logout', true)).toBe(false);
		expect(queueable('/ledger', false)).toBe(false);
	});
});

describe('toSyncItem', () => {
	it('shows the path and the posted fields', () => {
		const write: QueuedWrite = {
			id: 3,
			key: 'k',
			url: 'https://freyr.test/ledger?/create',
			headers: [['content-type', 'application/x-www-form-urlencoded;charset=UTF-8']],
			body: 'amount=1%2C250&category=4',
			action: true,
			at: 10
		};
		expect(toSyncItem(write)).toEqual({
			id: 3,
			path: '/ledger?/create',
			fields: { amount: '1,250', category: '4' },
			at: 10,
			error: undefined
		});
	});
});

describe('dataKey', () => {
	it('ignores which nodes were asked for, and the trailing-slash flag', () => {
		const a = dataKey(
			new URL('https://f.test/ledger/__data.json?month=8&x-sveltekit-invalidated=01')
		);
		const b = dataKey(
			new URL('https://f.test/ledger/__data.json?month=8&x-sveltekit-invalidated=11')
		);
		expect(a).toBe(b);
		expect(a).toBe('https://f.test/ledger/__data.json?month=8');
		expect(
			dataKey(
				new URL(
					'https://f.test/__data.json?x-sveltekit-trailing-slash=1&x-sveltekit-invalidated=01'
				)
			)
		).toBe('https://f.test/__data.json');
	});
});

describe('mergeData', () => {
	it('keeps a whole answer as it came', () => {
		expect(JSON.parse(mergeData(body([layout, page(1)]), null)!)).toEqual({
			type: 'data',
			nodes: [layout, page(1)]
		});
	});

	it('fills a skipped node from the kept copy', () => {
		const kept = body([layout, page(1)]);
		const merged = mergeData(body([{ type: 'skip' }, page(2)]), kept);
		expect(JSON.parse(merged!).nodes).toEqual([layout, page(2)]);
	});

	it('keeps a skip it has nothing to fill with', () => {
		const merged = mergeData(body([{ type: 'skip' }, page(2)]), null);
		expect(JSON.parse(merged!).nodes).toEqual([{ type: 'skip' }, page(2)]);
	});

	it('keeps nothing that is not page data', () => {
		expect(mergeData('{"type":"redirect","location":"/login"}', null)).toBeNull();
		expect(mergeData(body([layout, { type: 'error', error: {} }]), null)).toBeNull();
		expect(mergeData('not json', null)).toBeNull();
	});
});

describe('layoutData', () => {
	it('answers the root layout alone', () => {
		expect(JSON.parse(layoutData(body([layout, page(1)]))!)).toEqual({
			type: 'data',
			nodes: [layout]
		});
		expect(layoutData(body([{ type: 'skip' }, page(1)]))).toBeNull();
	});
});

describe('failureMessage', () => {
	it("reads the action's error out of devalue", () => {
		expect(failureMessage(stringify({ error: 'Pick a category.', values: { amount: '1' } }))).toBe(
			'Pick a category.'
		);
		expect(failureMessage(stringify({ values: {} }))).toBeNull();
		expect(failureMessage(undefined)).toBeNull();
		expect(failureMessage('[')).toBeNull();
	});
});

describe('judge', () => {
	const action = { action: true };
	const answer = (result: unknown, status = 200) => ({
		status,
		opaqueRedirect: false,
		busy: false,
		body: JSON.stringify(result)
	});

	it('drops a write that saved', () => {
		expect(judge(action, answer({ type: 'success', status: 200 }))).toEqual({ kind: 'done' });
		expect(judge(action, answer({ type: 'redirect', status: 303, location: '/ledger' }))).toEqual({
			kind: 'done'
		});
	});

	it('holds a write the session ended under, though it looks like success', () => {
		expect(judge(action, answer({ type: 'redirect', status: 303, location: '/login' }))).toEqual({
			kind: 'retry',
			signIn: true
		});
		expect(judge(action, { ...answer({}), opaqueRedirect: true })).toEqual({
			kind: 'retry',
			signIn: true
		});
	});

	it('holds a write Freyr could not take yet', () => {
		for (const status of [502, 503, 504])
			expect(judge(action, answer('', status))).toEqual({ kind: 'retry', signIn: false });
		expect(judge(action, { ...answer(''), status: 409, busy: true })).toEqual({
			kind: 'retry',
			signIn: false
		});
	});

	it("parks a refused write with the server's reason", () => {
		const data = stringify({ error: 'That category no longer exists.', values: {} });
		expect(judge(action, answer({ type: 'failure', status: 400, data }))).toEqual({
			kind: 'failed',
			message: 'That category no longer exists.'
		});
		expect(
			judge(action, answer({ type: 'error', error: { message: 'Internal Error' } }, 500))
		).toEqual({ kind: 'failed', message: 'Internal Error' });
		expect(judge(action, { ...answer(''), status: 403, body: '<html>' })).toEqual({
			kind: 'failed',
			message: 'Freyr answered 403.'
		});
	});

	it('takes a plain endpoint at its status', () => {
		const theme = { action: false };
		expect(judge(theme, { ...answer(''), opaqueRedirect: true, status: 0 })).toEqual({
			kind: 'done'
		});
		expect(judge(theme, answer('', 400))).toEqual({
			kind: 'failed',
			message: 'Freyr answered 400.'
		});
	});
});

describe('describeWrite', () => {
	const names: Record<string, string> = { '4': 'Food' };
	const name = (id: string) => names[id];

	it('names a transaction by its amount and category', () => {
		expect(
			describeWrite({ path: '/ledger?/create', fields: { amount: '1250.5', category: '4' } }, name)
		).toBe('Add ₹1,250.50 · Food');
		expect(describeWrite({ path: '/?/create', fields: { amount: '120', note: 'Tea' } }, name)).toBe(
			'Add ₹120 · Tea'
		);
		expect(
			describeWrite({ path: '/ledger/7?/update', fields: { amount: '99', category: '4' } }, name)
		).toBe('Edit ₹99 · Food');
		expect(describeWrite({ path: '/ledger/7?/delete', fields: {} }, name)).toBe(
			'Delete a transaction'
		);
	});

	it('names settings changes and the theme', () => {
		expect(
			describeWrite({ path: '/settings/categories?/add', fields: { name: 'Rent' } }, name)
		).toBe('Add the category Rent');
		expect(
			describeWrite({ path: '/settings/categories?/archive', fields: { archived: '0' } }, name)
		).toBe('Restore a category');
		expect(describeWrite({ path: '/settings/budget?/savePolicy', fields: {} }, name)).toBe(
			'Save the split policy'
		);
		expect(describeWrite({ path: '/theme', fields: { to: 'dark' } }, name)).toBe('Theme: Dark');
		expect(describeWrite({ path: '/elsewhere?/x', fields: {} }, name)).toBe(
			'A change on /elsewhere'
		);
	});
});

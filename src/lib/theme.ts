/**
 * The theme setting's three answers. "system" is the absence of a choice: no
 * cookie, no attribute on <html>, and prefers-color-scheme decides (app.css).
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** A posted value → a choice. Anything unrecognised is light, as it always was. */
export function toThemeChoice(value: unknown): ThemeChoice {
	return value === 'system' || value === 'dark' ? value : 'light';
}

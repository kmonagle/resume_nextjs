// Why this file exists: the one demo guard-rail the UI mentions to visitors. The
// backends enforce the limits themselves (20 links per visitor, 5,000 in total,
// 30-day retention); the number here only feeds the form's explanatory note.
export const LINK_RETENTION_DAYS = 30;

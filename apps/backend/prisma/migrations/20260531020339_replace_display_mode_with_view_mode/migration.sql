-- Replace display_mode with view_mode
ALTER TABLE display_layouts RENAME COLUMN display_mode TO view_mode;
UPDATE display_layouts SET view_mode = 'multi' WHERE view_mode IN ('grid', 'gauge');

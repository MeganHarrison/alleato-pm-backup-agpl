-- ============================================================
-- Seed: Photos Tool — Scenario-Type Test Cases
-- Generated: 2026-04-07
-- Suite: tool_name = 'photos'
-- ============================================================

-- Step 1: Upsert the suite
INSERT INTO public.test_suites (tool_name, display_name, total_cases)
VALUES ('photos', 'Photos', 0)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  last_generated_at = now();
-- Step 2: Insert all scenario-type test cases
WITH suite AS (SELECT id FROM public.test_suites WHERE tool_name = 'photos')
INSERT INTO public.test_cases
  (suite_id, test_number, category, subcategory, test_name,
   context_note, setup_steps, steps, expected_result, priority,
   test_type, start_url)
VALUES

-- ═══════════════════════════════════════════════════════
-- 1. NAVIGATION & VIEWS
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '1.1', 'Navigation', 'Page load',
 'Open the Photos page for a project',
 'Checks that the Photos page loads without errors and shows the main photo grid or an empty state.',
 'Make sure you are logged in as test1@mail.com.',
 E'1. In the left sidebar, click **Photos** under the "Vermillion Rise Warehouse" project.\n2. Wait for the page to finish loading.',
 'The Photos page opens. Either a grid of photos is visible, or an empty state that says "No photos yet" appears. No error messages are shown.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '1.2', 'Navigation', 'Tabs',
 'Switch between the Photos, Map, Timeline, Albums, and Recycle Bin tabs',
 'Checks that all five tabs exist and can be clicked without causing an error.',
 'Be on the Photos page at /67/photos.',
 E'1. Click the **Map** tab.\n2. Click the **Timeline** tab.\n3. Click the **Albums** tab.\n4. Click the **Recycle Bin** tab.\n5. Click the **Photos** tab to return to the main view.',
 'Each tab displays without a crash. Map, Timeline, and Albums tabs show an informational message. Recycle Bin tab opens. The Photos tab returns to the grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '1.3', 'Navigation', 'Empty state',
 'View the empty state when no photos exist',
 'Checks that a helpful message and an Upload button appear when no photos have been added yet.',
 'The project must have zero photos. If there are photos, this test is not applicable.',
 E'1. Navigate to the Photos page at /67/photos.\n2. Make sure no photos are present.',
 'A message "No photos yet" and a prompt to upload or drag-and-drop is visible. An **Upload Photo** button appears.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '1.4', 'Navigation', 'Photo grid',
 'View the photo grid with thumbnails',
 'Checks that uploaded photos appear as thumbnail cards in the grid layout.',
 'At least one photo must already exist in the project.',
 E'1. Navigate to /67/photos.\n2. Look at the main Photos tab.',
 'Photos appear as thumbnail cards arranged in a grid. Each card shows an image preview, a title, and a date.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '1.5', 'Navigation', 'Lightbox',
 'Open a photo in the lightbox detail view',
 'Checks that clicking a photo opens a larger view with full details.',
 'At least one photo must exist in the project.',
 E'1. On the Photos page, click any photo thumbnail.\n2. Wait for the detail view to open.',
 'A dialog opens showing a larger version of the photo, its title, description (if set), album badge, location, trade, file size, date, and dimensions. Action buttons (Star, Delete) are visible.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '1.6', 'Navigation', 'Lightbox close',
 'Close the photo lightbox',
 'Checks that the lightbox can be dismissed and the grid view returns.',
 'A photo lightbox must be open.',
 E'1. Open a photo by clicking its thumbnail.\n2. Click the X button at the top-right of the lightbox dialog.',
 'The lightbox closes and the photo grid is visible again.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '1.7', 'Navigation', 'Mobile FAB',
 'Use the mobile upload button',
 'Checks that a floating action button appears on narrow screens for quick photo upload.',
 'Use a mobile-sized browser window (or resize your browser to about 375px wide).',
 E'1. Resize your browser window to a narrow width (like a mobile phone).\n2. Navigate to /67/photos.\n3. Look at the bottom-right corner of the screen.',
 'A round Upload button appears at the bottom-right. Clicking it opens the Upload Photos dialog.',
 'LOW', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 2. UPLOAD
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '2.1', 'Upload', 'Single file via dialog',
 'Upload a single photo using the Upload Photo button',
 'Checks that a user can upload one image file and have it appear in the grid.',
 'Have a small image file (JPG or PNG) ready on your computer.',
 E'1. Click the **Upload Photo** button in the top-right of the page.\n2. In the dialog that opens, click the drop zone area (it says "Drop photos here or browse").\n3. Select one image file from your computer.\n4. Click **Upload Photo**.\n5. Wait for the page to stop loading.',
 'The dialog closes. The new photo appears in the grid. An upload progress indicator may briefly appear at the top of the page.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.2', 'Upload', 'Multiple files via dialog',
 'Upload multiple photos at once',
 'Checks that more than one image can be selected and uploaded in a single batch.',
 'Have two or more image files ready on your computer.',
 E'1. Click **Upload Photo**.\n2. In the dialog, click the drop zone and select 2–3 image files.\n3. Confirm the file list shows all selected files.\n4. Click **Upload X Photos**.\n5. Wait for the page to finish loading.',
 'All selected photos appear in the grid. The file count on the upload button showed the correct number before submission.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.3', 'Upload', 'Drag and drop onto page',
 'Upload photos by dragging and dropping files directly onto the page',
 'Checks that photos can be uploaded without clicking any button — just by dragging files from your desktop.',
 'Have at least one image file ready to drag. Be on the Photos tab (not Map/Timeline/Albums).',
 E'1. Open a folder on your computer with an image file.\n2. Drag the image file from the folder and drop it anywhere on the Photos page (the main grid area).\n3. Wait for the upload to complete.',
 'While dragging, a blue overlay appears with the message "Drop images to upload". After dropping, the photo uploads and appears in the grid. An upload progress banner briefly shows "Uploading photos...".',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.4', 'Upload', 'Drag and drop inside dialog',
 'Upload photos by dragging into the upload dialog drop zone',
 'Checks that the dialog drop zone also accepts drag-and-drop, not just file-browser selection.',
 'Have an image file ready to drag.',
 E'1. Click **Upload Photo** to open the dialog.\n2. Drag an image file from your desktop and drop it into the dashed drop zone in the dialog.\n3. Confirm the file appears in the list below the drop zone.\n4. Click **Upload Photo**.',
 'The file appears in the queue list inside the dialog. After clicking Upload, the photo appears in the grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.5', 'Upload', 'Select album during upload',
 'Choose a specific album when uploading a photo',
 'Checks that the album selected in the upload dialog is applied to the uploaded photo.',
 'Have an image file ready.',
 E'1. Click **Upload Photo**.\n2. Select one image file.\n3. In the **Album** dropdown inside the dialog, change the selection from "Default" to **Safety**.\n4. Click **Upload Photo**.\n5. After upload, filter the grid by the "Safety" album.',
 'The uploaded photo appears when the Safety album filter is active. The album badge on the photo card or lightbox shows "Safety".',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.6', 'Upload', 'Remove file from queue',
 'Remove a file from the upload queue before uploading',
 'Checks that a user can deselect a file they added by mistake before actually uploading.',
 NULL,
 E'1. Click **Upload Photo**.\n2. Select two image files.\n3. In the file list, click the X button next to the first file.\n4. Confirm only one file remains in the list.\n5. Click **Upload Photo**.',
 'Only one photo uploads and appears in the grid. The removed file is not uploaded.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.7', 'Upload', 'Cancel upload dialog',
 'Cancel the upload dialog without uploading anything',
 'Checks that clicking Cancel closes the dialog and does not upload any files.',
 NULL,
 E'1. Click **Upload Photo**.\n2. Select one image file.\n3. Click **Cancel**.',
 'The dialog closes. No new photo appears in the grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.8', 'Upload', 'Non-image file rejected',
 'Try to upload a non-image file (e.g. a PDF or Word document)',
 'Checks that only image files are accepted and other file types are silently ignored.',
 'Have a non-image file (like a .pdf or .txt) ready.',
 E'1. Click **Upload Photo**.\n2. Try to select a PDF or text file in the file browser (you may need to change the file type filter to "All Files").\n3. Attempt to submit.',
 'The non-image file is either not accepted by the file picker, or it is ignored and not added to the queue. No PDF or document appears in the grid after upload.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.9', 'Upload', 'File size limit',
 'Try to upload a file larger than 20 MB',
 'Checks that files over the 20 MB size limit are silently skipped and do not cause an error.',
 'Have an image file larger than 20 MB ready, if available.',
 E'1. Click **Upload Photo**.\n2. Select an image file that is larger than 20 MB.\n3. Click **Upload Photo**.',
 'The oversized file is skipped. No error message crashes the page. Other files in the same batch (if any) still upload successfully.',
 'LOW', 'scenario', '/67/photos'),

((SELECT id FROM suite), '2.10', 'Upload', 'Title auto-derived from filename',
 'Confirm the photo title is automatically set from the filename after upload',
 'Checks that when a photo is uploaded, its title is generated from the filename (with dashes/underscores replaced by spaces and title-cased).',
 'Upload a photo with a hyphenated filename like "site-progress-01.jpg".',
 E'1. Click **Upload Photo**.\n2. Select an image file named something like "site-progress-01.jpg".\n3. Upload it.\n4. Click on the newly uploaded photo to open the lightbox.',
 'The lightbox title shows "Site Progress 01" (or similar — underscores/dashes replaced with spaces, first letters capitalized). The filename was used as the source.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 3. VIEW & SEARCH
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '3.1', 'View & Search', 'Search by title',
 'Search for a photo by its title',
 'Checks that typing in the search bar filters the photo grid to show only matching photos.',
 'At least two photos with different titles must exist.',
 E'1. On the Photos page, click in the **Search photos...** box.\n2. Type part of a known photo title (e.g. "site").\n3. Watch the grid update.',
 'Only photos whose title, description, or filename contains the search term are shown. Other photos disappear from the grid.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '3.2', 'View & Search', 'Clear search',
 'Clear the search filter to show all photos again',
 'Checks that after searching, the X button restores the full photo list.',
 'A search must be active in the search box.',
 E'1. Type a search term in the **Search photos...** box.\n2. Click the **X** button that appears inside the search box on the right side.',
 'The search box clears and all photos reappear in the grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '3.3', 'View & Search', 'Filter by album',
 'Filter the photo grid to show only photos from a specific album',
 'Checks that the album dropdown correctly filters the photo list.',
 'Photos must exist in at least two different albums.',
 E'1. Click the **All Albums** dropdown next to the search box.\n2. Select **Safety** from the dropdown.\n3. Observe the photo grid.',
 'Only photos assigned to the "Safety" album appear. Photos in other albums are hidden.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '3.4', 'View & Search', 'Filter by All Albums',
 'Reset album filter back to All Albums',
 'Checks that selecting "All Albums" from the dropdown removes the album filter and shows all photos.',
 'An album filter must be active.',
 E'1. Select a specific album from the dropdown (e.g. "Safety").\n2. Open the dropdown again and select **All Albums**.',
 'All photos appear in the grid regardless of their album.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '3.5', 'View & Search', 'Search + album filter combined',
 'Use search and album filter at the same time',
 'Checks that combining a text search with an album filter narrows results correctly.',
 'Photos must exist in multiple albums with varied titles.',
 E'1. Select **Progress** from the album dropdown.\n2. Type a keyword in the search box.\n3. Observe the results.',
 'Only photos that match both the album "Progress" AND the keyword appear. Photos matching only one criterion are excluded.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '3.6', 'View & Search', 'No results state',
 'See the empty state when search finds no matching photos',
 'Checks that a helpful message appears when search or album filter returns zero results.',
 'At least one photo must exist.',
 E'1. Type a nonsense word like "zzzzzzz" in the search box.',
 'The grid clears and a message appears explaining no photos match the current filters.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 4. EDIT
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '4.1', 'Edit', 'Add description to a photo',
 'Add or edit the description on a photo after it has been uploaded',
 'Checks that the description field can be set on an existing photo and persists after saving.',
 'At least one photo must exist.',
 E'1. Click a photo thumbnail to open the lightbox.\n2. Look for a description field or edit option.\n3. Enter the text "Test description for scenario 4.1".\n4. Save the changes.',
 'The description "Test description for scenario 4.1" appears in the lightbox detail area. After refreshing the page and reopening the photo, the description is still shown.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '4.2', 'Edit', 'Edit photo title',
 'Change the title of an existing photo',
 'Checks that the photo title can be updated and the new title appears on the card and in the lightbox.',
 'At least one photo must exist.',
 E'1. Click a photo to open the lightbox.\n2. Find the title field and change it to "Updated Title Scenario 4.2".\n3. Save the changes.\n4. Close the lightbox.',
 'The photo card in the grid and the lightbox both show the updated title "Updated Title Scenario 4.2".',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '4.3', 'Edit', 'Set photo location',
 'Assign a location label to a photo',
 'Checks that a location can be added to a photo and shows in the lightbox details.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Location** field and type "Level 2 - Electrical Room".\n3. Save the changes.',
 'The location "Level 2 - Electrical Room" appears in the photo details in the lightbox. It persists after refreshing the page.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '4.4', 'Edit', 'Set photo trade',
 'Assign a trade category to a photo',
 'Checks that a trade label can be assigned to a photo and is visible in the lightbox.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Trade** field and enter "Electrical".\n3. Save the changes.',
 'The trade "Electrical" appears in the photo detail area of the lightbox.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '4.5', 'Edit', 'Change photo album after upload',
 'Move a photo to a different album by editing it',
 'Checks that the album assignment on an existing photo can be changed.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Album** field and change it to **Inspections**.\n3. Save the changes.',
 'The album badge on the photo updates to "Inspections". When filtering by "Inspections", the photo appears.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '4.6', 'Edit', 'Add tags to a photo',
 'Add keyword tags to a photo for easier searching',
 'Checks that tags can be added to a photo and appear as badges in the lightbox view.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Tags** field and add the tags "concrete" and "foundation".\n3. Save the changes.',
 'The tags "concrete" and "foundation" appear as small badge labels inside the lightbox details section.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '4.7', 'Edit', 'Set date taken',
 'Set or change the "date taken" field on a photo',
 'Checks that the capture date can be manually set and is shown in the photo metadata.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Date Taken** field and set it to today\'s date.\n3. Save the changes.',
 'The date taken is updated and visible in the photo metadata area of the lightbox.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 5. STAR / FAVORITE
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '5.1', 'Star', 'Star a photo from the grid',
 'Mark a photo as starred (favorited) by clicking the star icon on the thumbnail',
 'Checks that hovering over a photo card reveals a star button, and clicking it marks the photo as starred.',
 'At least one photo must exist that is not yet starred.',
 E'1. Hover your mouse over a photo thumbnail in the grid.\n2. Click the star icon that appears in the top-right corner of the thumbnail.\n3. Observe the star state.',
 'The star icon fills in (becomes solid/colored) to indicate the photo is now starred. The change is saved without needing to click a separate Save button.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '5.2', 'Star', 'Unstar a photo from the grid',
 'Remove the star from a previously starred photo',
 'Checks that clicking the star icon on an already-starred photo removes the favorite status.',
 'At least one starred photo must exist.',
 E'1. Hover over a photo that is already starred (star icon is filled/colored).\n2. Click the star icon.',
 'The star icon becomes hollow/empty, indicating the photo is no longer starred.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '5.3', 'Star', 'Star a photo from the lightbox',
 'Star a photo using the Star button inside the lightbox detail view',
 'Checks that the lightbox action buttons include a Star option that works correctly.',
 'At least one photo must be open in the lightbox.',
 E'1. Click a photo to open the lightbox.\n2. Find the **Star** button at the bottom of the dialog.\n3. Click it.',
 'The button label changes to "Starred" and the star icon fills in. The photo is now marked as a favorite.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '5.4', 'Star', 'Find starred photos using the filter',
 'Filter the grid to show only starred photos',
 'Checks that starred photos can be found using a filter or dedicated view.',
 'At least one starred photo must exist.',
 E'1. Navigate to /67/photos.\n2. Look for a way to filter by starred photos (e.g. a "Starred" tab, sidebar item, or filter chip).\n3. Select it.',
 'Only photos that have been starred are shown in the view.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 6. DELETE & RECYCLE BIN
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '6.1', 'Delete', 'Delete a photo from the lightbox',
 'Delete a photo using the Delete button inside the lightbox',
 'Checks that a photo can be removed from the grid and is sent to the recycle bin.',
 'At least one photo must exist.',
 E'1. Click a photo thumbnail to open the lightbox.\n2. Click the **Delete** button (shown in red or with a trash icon).\n3. Wait for the action to complete.',
 'The lightbox closes. The deleted photo no longer appears in the main photo grid.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '6.2', 'Delete', 'View deleted photo in Recycle Bin',
 'Confirm that a deleted photo appears in the Recycle Bin tab',
 'Checks that deleting a photo sends it to the recycle bin rather than permanently removing it.',
 'At least one photo must have been deleted.',
 E'1. After deleting a photo, click the **Recycle Bin** tab.\n2. Look for the recently deleted photo.',
 'The deleted photo appears in the Recycle Bin tab. The main Photos tab no longer shows the photo.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '6.3', 'Delete', 'Retrieve a photo from the Recycle Bin',
 'Restore a deleted photo back to the main photo library',
 'Checks that photos in the recycle bin can be recovered.',
 'At least one photo must be in the Recycle Bin.',
 E'1. Click the **Recycle Bin** tab.\n2. Find a deleted photo.\n3. Click the restore/retrieve button for that photo.\n4. Switch back to the **Photos** tab.',
 'The photo reappears in the main Photos grid. It no longer appears in the Recycle Bin.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '6.4', 'Delete', 'Permanently delete a photo from the Recycle Bin',
 'Permanently remove a photo from the Recycle Bin so it cannot be recovered',
 'Checks that permanent deletion works from the Recycle Bin and truly removes the photo.',
 'At least one photo must be in the Recycle Bin.',
 E'1. Click the **Recycle Bin** tab.\n2. Find a photo.\n3. Click the permanent delete button (usually a "Delete Permanently" or trash icon option).\n4. Confirm the deletion if prompted.',
 'The photo is removed from the Recycle Bin. It does not appear in the Photos tab either. The action cannot be undone.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '6.5', 'Delete', 'Recycle Bin 30-day retention note',
 'Verify the Recycle Bin shows a retention policy message',
 'Checks that the Recycle Bin tab displays a message explaining that deleted photos are kept for 30 days.',
 NULL,
 E'1. Click the **Recycle Bin** tab.',
 'A message is visible explaining that deleted photos are kept for 30 days before being permanently removed.',
 'LOW', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 7. ALBUMS
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '7.1', 'Albums', 'View the Albums tab',
 'Open the Albums tab and see album groupings',
 'Checks that the Albums tab exists and shows the list of available albums.',
 NULL,
 E'1. Navigate to /67/photos.\n2. Click the **Albums** tab.',
 'The Albums view opens. Available albums are shown (e.g. Default, Progress, Safety, Inspections, Deliveries, Deficiencies, Closeout).',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '7.2', 'Albums', 'Create a photo album',
 'Create a new custom album to organize photos',
 'Checks that a user can add a named album and that it appears in the album list and the album dropdown.',
 NULL,
 E'1. Click the **Albums** tab.\n2. Look for a **Create Album** or **New Album** button and click it.\n3. Type a name like "Structural Steel".\n4. Save the album.',
 'The new album "Structural Steel" appears in the Albums list. It also becomes available in the album dropdown on the main Photos tab.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '7.3', 'Albums', 'Delete an album',
 'Delete an album from the Albums view',
 'Checks that an album can be removed from the project.',
 'A custom album must exist (do not delete built-in albums).',
 E'1. Click the **Albums** tab.\n2. Find a custom album.\n3. Click the delete or remove option for that album.\n4. Confirm if prompted.',
 'The album is removed from the list. Photos that were in it still exist in the project (they may be unassigned or moved to Default).',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '7.4', 'Albums', 'Reorder albums',
 'Change the display order of albums by dragging them',
 'Checks that albums can be reordered by the user and the new order persists.',
 'At least two albums must exist.',
 E'1. Click the **Albums** tab.\n2. Find the drag handle on an album card.\n3. Drag one album above another to reorder.\n4. Release the mouse button.',
 'The albums appear in the new order. After refreshing the page, the custom order is preserved.',
 'LOW', 'scenario', '/67/photos'),

((SELECT id FROM suite), '7.5', 'Albums', 'Select an album cover photo',
 'Set a specific photo as the cover image for an album',
 'Checks that a photo can be designated as the thumbnail/cover for an album.',
 'An album with at least one photo must exist.',
 E'1. Click the **Albums** tab.\n2. Open an album that has photos.\n3. Find the option to set or change the cover photo.\n4. Select a photo to use as the cover.\n5. Save.',
 'The selected photo appears as the cover thumbnail for that album on the Albums tab.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 8. DOWNLOAD & EXPORT
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '8.1', 'Download', 'Download a single photo',
 'Download one photo to your computer',
 'Checks that a photo can be downloaded as an image file.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find a **Download** button or link.\n3. Click it.',
 'The photo file downloads to your computer. The file opens as a valid image.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '8.2', 'Download', 'Download multiple photos',
 'Select multiple photos and download them all at once',
 'Checks that bulk download works for multiple selected photos.',
 'At least two photos must exist.',
 E'1. Select two or more photos using checkboxes (or shift-click).\n2. Look for a **Download** option in the bulk action bar.\n3. Click **Download**.',
 'All selected photos download, either as individual files or as a zip archive.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '8.3', 'Export', 'Export photos as a PDF',
 'Export one or more photos as a PDF document',
 'Checks that the PDF export feature creates a downloadable PDF with the selected photos.',
 'At least one photo must exist.',
 E'1. Select one or more photos using checkboxes.\n2. Find the **Export as PDF** option in the toolbar or action menu.\n3. Click it and wait for the PDF to generate.\n4. Open the downloaded file.',
 'A PDF file downloads. Opening it shows the selected photos with their titles and metadata.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 9. EMAIL
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '9.1', 'Email', 'Send photos by email (outbound)',
 'Email one or more photos to someone from within the Photos tool',
 'Checks that the outbound email feature lets you send photos to an email address.',
 'At least one photo must exist.',
 E'1. Select one or more photos using checkboxes.\n2. Find the **Email** button or option in the action bar.\n3. Click it.\n4. In the email dialog, enter a recipient email address (use your own for testing).\n5. Add a subject and message.\n6. Click **Send**.',
 'A success confirmation appears. An email with the selected photos (or a link to them) is sent to the provided address.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '9.2', 'Email', 'Upload photos via inbound email',
 'Add photos to the project by emailing them to the project''s unique email address',
 'Checks that the inbound email feature works — photos sent to the project email appear in the Photos tool.',
 'You need the project''s unique inbound email address from the Photos settings.',
 E'1. Open **Configure Advanced Settings** for Photos (settings/gear icon).\n2. Find the **Email to Photos** address for this project.\n3. Send an email to that address with a photo attached.\n4. Wait 1–2 minutes.\n5. Refresh the Photos page.',
 'The photo from the email appears in the photo grid, assigned to the correct project.',
 'LOW', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 10. COMMENTS & MENTIONS
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '10.1', 'Comments', 'Add a comment to a photo',
 'Leave a comment on a photo',
 'Checks that users can add text comments to individual photos.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Comments** section or input field.\n3. Type "This is a test comment from scenario 10.1".\n4. Click **Post** or press Enter to submit.',
 'The comment "This is a test comment from scenario 10.1" appears in the comments section of the photo.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '10.2', 'Comments', 'Mention someone in a comment',
 'Tag a team member in a photo comment using @mention',
 'Checks that typing @ in a comment triggers a list of project members that can be mentioned.',
 'At least one photo must exist. At least one other user must be a member of the project.',
 E'1. Open a photo in the lightbox.\n2. In the comment input, type "@" followed by the first few letters of a team member''s name.\n3. Select the person from the dropdown that appears.\n4. Finish typing your comment and click **Post**.',
 'The comment is posted with the person''s name highlighted as a mention. The mentioned person may receive a notification.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '10.3', 'Comments', 'View comments on a photo',
 'Open a photo and see existing comments',
 'Checks that previously posted comments are visible when a photo is opened.',
 'A photo with at least one comment must exist.',
 E'1. Open a photo that has comments on it.\n2. Look at the comments section.',
 'All existing comments appear in the lightbox, with the commenter''s name and the comment text visible.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 11. PRIVACY
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '11.1', 'Privacy', 'Mark a photo as private',
 'Set a photo to private so only certain users can see it',
 'Checks that the private flag can be set on a photo.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Private** toggle or checkbox.\n3. Turn it on.\n4. Save the change.',
 'The photo is marked as private. A private indicator (lock icon or "Private" label) appears on the photo card or in the lightbox.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '11.2', 'Privacy', 'Remove private flag from a photo',
 'Make a private photo visible to all project members again',
 'Checks that the private setting can be toggled off.',
 'At least one photo marked as private must exist.',
 E'1. Open a private photo in the lightbox.\n2. Find the **Private** toggle and turn it off.\n3. Save the change.',
 'The private indicator disappears from the photo. The photo is now visible to all project members.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 12. MOVE
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '12.1', 'Move', 'Move a photo to a different album',
 'Move an existing photo from one album to another',
 'Checks that the Move feature reassigns the photo to a new album.',
 'At least one photo and at least two albums must exist.',
 E'1. Select a photo using its checkbox.\n2. Find the **Move** option in the toolbar or right-click menu.\n3. Select the destination album (e.g. "Progress").\n4. Confirm the move.',
 'The photo no longer appears in its original album when filtered. It appears in the destination album.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '12.2', 'Move', 'Move multiple photos at once',
 'Select multiple photos and move them all to a new album in one action',
 'Checks that the bulk move feature works for more than one photo.',
 'At least two photos must exist.',
 E'1. Select two or more photos using checkboxes.\n2. Find the **Move** option in the bulk actions bar.\n3. Select the destination album.\n4. Confirm.',
 'All selected photos move to the destination album. They appear when filtering by that album.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 13. ROTATE
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '13.1', 'Rotate', 'Rotate a photo 90 degrees',
 'Rotate a photo to correct its orientation',
 'Checks that the rotate feature changes the photo orientation and saves the result.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Rotate** button or option.\n3. Click it once to rotate 90 degrees clockwise.\n4. Save or confirm.',
 'The photo appears rotated 90 degrees. After closing and reopening the lightbox, the rotated orientation is preserved.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 14. BULK EDIT
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '14.1', 'Bulk Edit', 'Bulk edit album assignment',
 'Select multiple photos and change their album all at once',
 'Checks that the bulk edit feature can update the album field on many photos simultaneously.',
 'At least two photos must exist.',
 E'1. Select two or more photos by clicking their checkboxes.\n2. Find the **Bulk Edit** or **Edit** option in the selection toolbar.\n3. Change the **Album** field to "Safety".\n4. Apply the changes.',
 'All selected photos are now in the "Safety" album. Filtering by Safety shows all the edited photos.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '14.2', 'Bulk Edit', 'Bulk edit location',
 'Assign a location to multiple photos at once',
 'Checks that bulk edit can set the location field across multiple selected photos.',
 'At least two photos must exist.',
 E'1. Select two or more photos.\n2. Open **Bulk Edit**.\n3. Set the **Location** field to "Roof Level".\n4. Apply.',
 'All selected photos have their location updated to "Roof Level". Opening each in the lightbox confirms the location.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '14.3', 'Bulk Edit', 'Bulk edit trade',
 'Assign a trade to multiple photos at once',
 'Checks that the trade field can be bulk-applied across selected photos.',
 'At least two photos must exist.',
 E'1. Select two or more photos.\n2. Open **Bulk Edit**.\n3. Set the **Trade** field to "Plumbing".\n4. Apply.',
 'All selected photos show "Plumbing" as their trade in the lightbox details.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '14.4', 'Bulk Edit', 'Bulk delete photos',
 'Select multiple photos and delete them all at once',
 'Checks that the bulk delete action removes all selected photos and sends them to the recycle bin.',
 'At least two photos must exist.',
 E'1. Select two or more photos using checkboxes.\n2. Find the **Delete** option in the bulk actions bar.\n3. Confirm the deletion if prompted.',
 'All selected photos disappear from the main grid. They appear in the Recycle Bin tab.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '14.5', 'Bulk Edit', 'Select all photos',
 'Use a "Select All" action to select every photo on the page',
 'Checks that a select-all mechanism exists and selects every visible photo.',
 'At least two photos must be visible.',
 E'1. On the Photos page, find a **Select All** checkbox or button (usually in the toolbar).\n2. Click it.',
 'All photo cards show a checkmark or highlighted border indicating selection. The bulk actions bar appears or updates with the total count.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 15. SUBSCRIBE / NOTIFICATIONS
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '15.1', 'Notifications', 'Subscribe to photos',
 'Subscribe to receive notifications when new photos are added to the project',
 'Checks that a user can subscribe to the Photos tool and will be notified of new activity.',
 NULL,
 E'1. Navigate to /67/photos.\n2. Find the **Subscribe** button or bell icon.\n3. Click it to subscribe.',
 'A confirmation appears that you are now subscribed. The button may change to "Subscribed" or show an active state.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '15.2', 'Notifications', 'Unsubscribe from photos',
 'Turn off notifications for the Photos tool',
 'Checks that a subscribed user can unsubscribe and stop receiving notifications.',
 'You must already be subscribed.',
 E'1. Navigate to /67/photos.\n2. Find the **Subscribed** or active subscribe button.\n3. Click it to unsubscribe.',
 'The button changes back to an inactive/unsubscribed state. You will no longer receive notifications for new photos.',
 'LOW', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 16. MAP VIEW
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '16.1', 'Map', 'View geotagged photos on map',
 'Open the Map tab to see photos plotted on the project map',
 'Checks that the Map tab shows geotagged photos as pins on a map.',
 'At least one photo with a location or GPS coordinates must exist.',
 E'1. Navigate to /67/photos.\n2. Click the **Map** tab.\n3. Look for photo pins on the map.',
 'Photos with location data appear as pins on the map. Clicking a pin shows a preview of the photo.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '16.2', 'Map', 'Add a photo pin to the map',
 'Assign a map location to a photo so it appears as a pin',
 'Checks that a specific map location (coordinates or drawing pin) can be attached to a photo.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Set Location** or **Add to Map** option.\n3. Select or enter coordinates or click on a map to place a pin.\n4. Save.',
 'The photo appears as a pin on the Map tab at the specified location.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 17. TIMELINE VIEW
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '17.1', 'Timeline', 'View photos chronologically in Timeline',
 'Open the Timeline tab to browse photos by date',
 'Checks that the Timeline tab groups photos chronologically to show project progress over time.',
 'At least two photos with different dates must exist.',
 E'1. Navigate to /67/photos.\n2. Click the **Timeline** tab.',
 'Photos are organized by date, with oldest first (or newest first). The timeline clearly shows when each photo was taken.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 18. SETTINGS / CONFIGURATION
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '18.1', 'Settings', 'Open Photos advanced settings',
 'Access the advanced configuration settings for the Photos tool',
 'Checks that a settings or gear icon is accessible from the Photos page and opens a configuration panel.',
 NULL,
 E'1. Navigate to /67/photos.\n2. Find the **Settings** or gear icon button.\n3. Click it.',
 'A settings page or dialog opens showing configuration options for the Photos tool.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '18.2', 'Settings', 'Set the project cover photo',
 'Designate one photo as the project''s main cover photo',
 'Checks that a photo can be set as the project cover image, which appears on the project dashboard.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Find the **Set as Project Photo** option.\n3. Click it.\n4. Navigate to the project home page.',
 'The selected photo appears as the project cover or hero image on the project overview page.',
 'MEDIUM', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 19. PERMISSIONS
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '19.1', 'Permissions', 'Read-only user cannot upload photos',
 'Verify that a user with read-only access cannot upload photos',
 'Checks that the Upload button is hidden or disabled for users who only have view access.',
 'A second user account with read-only access to the project must be available.',
 E'1. Log in as a user who only has read-only access to the project.\n2. Navigate to /67/photos.\n3. Look for the Upload Photo button.',
 'The **Upload Photo** button is either hidden or disabled. The user cannot add new photos.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '19.2', 'Permissions', 'Read-only user cannot delete photos',
 'Verify that a read-only user cannot delete photos',
 'Checks that the Delete button in the lightbox is hidden or disabled for read-only users.',
 'A second user account with read-only access must be available.',
 E'1. Log in as a read-only user.\n2. Click a photo to open the lightbox.\n3. Look for a Delete button.',
 'The **Delete** button is absent or grayed out. The user cannot delete photos.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '19.3', 'Permissions', 'Standard user can view private photos of their own',
 'Check that a user can see photos they marked as private',
 'Checks that private photos are still visible to the user who created them.',
 'A photo marked as private by the test user must exist.',
 E'1. Log in as test1@mail.com.\n2. Navigate to /67/photos.\n3. Look for a photo you previously marked as private.',
 'The private photo is still visible to you (the owner). A lock icon or "Private" label may appear on the card.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '19.4', 'Permissions', 'Private photo hidden from other standard users',
 'Confirm that a photo marked as private does not appear for other users',
 'Checks that private photos are not visible to team members who did not upload them.',
 'A photo marked as private by user A must exist. A second user B must have access to the project.',
 E'1. As user A, upload and mark a photo as private.\n2. Log out and log in as user B.\n3. Navigate to /67/photos.\n4. Look for the private photo.',
 'The private photo does not appear in user B''s grid view.',
 'HIGH', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 20. INTEGRATION — DAILY LOG
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '20.1', 'Integration', 'Photo added in Daily Log appears in Photos',
 'Add a photo to a Daily Log entry and confirm it shows up in the Photos tool',
 'Checks that photos uploaded through the Daily Log are also accessible from the Photos page.',
 'The Daily Log tool must be enabled for the project.',
 E'1. Navigate to the **Daily Log** for the project.\n2. Create or edit a log entry.\n3. Attach a photo to the log entry.\n4. Save the log entry.\n5. Navigate to /67/photos.',
 'The photo attached to the Daily Log entry appears in the Photos tool grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '20.2', 'Integration', 'Photos added from Inspections appear in Photos',
 'Add a photo to an Inspection item and confirm it appears in the Photos tool',
 'Checks cross-tool photo sharing — photos from Inspections flow into the Photos library.',
 'The Inspections tool must be enabled.',
 E'1. Navigate to the **Inspections** tool.\n2. Open or create an inspection item.\n3. Attach a photo.\n4. Save.\n5. Navigate to /67/photos.',
 'The photo attached in Inspections now appears in the Photos grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '20.3', 'Integration', 'Photos added from Observations appear in Photos',
 'Add a photo to an Observation and confirm it populates the Photos tool',
 'Checks that Observations photos cross-populate into the Photos library.',
 'The Observations tool must be enabled.',
 E'1. Navigate to the **Observations** tool.\n2. Open or create an observation.\n3. Attach a photo.\n4. Save.\n5. Navigate to /67/photos.',
 'The photo from the Observation appears in the Photos grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '20.4', 'Integration', 'Photos added from Punch List appear in Photos',
 'Add a photo to a Punch List item and confirm it appears in the Photos tool',
 'Checks cross-tool photo integration between Punch List and Photos.',
 'The Punch List tool must be enabled.',
 E'1. Navigate to the **Punch List** tool.\n2. Open a punch list item.\n3. Attach a photo.\n4. Save.\n5. Navigate to /67/photos.',
 'The photo from the punch list item appears in the Photos grid.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '20.5', 'Integration', 'Add a photo pin to a Drawing',
 'Link a photo to a specific spot on a project drawing',
 'Checks that photos can be pinned to drawing sheets, and the pin is visible on the drawing.',
 'The Drawings tool must have at least one drawing sheet uploaded.',
 E'1. Navigate to the **Drawings** tool.\n2. Open a drawing sheet.\n3. Find the option to add a photo pin to the drawing.\n4. Click a location on the drawing and select a photo from the Photos library.\n5. Save.',
 'A photo pin marker appears at the selected spot on the drawing. Clicking the pin shows the linked photo.',
 'LOW', 'scenario', '/67/photos'),

-- ═══════════════════════════════════════════════════════
-- 21. EDGE CASES
-- ═══════════════════════════════════════════════════════

((SELECT id FROM suite), '21.1', 'Edge Cases', 'Upload with duplicate filename',
 'Upload a photo with the same filename as an existing photo',
 'Checks that duplicate filenames do not overwrite existing photos — each upload creates a separate record.',
 'Upload a photo, note its filename, then upload another photo with the exact same filename.',
 E'1. Upload a photo named "test.jpg".\n2. Upload another photo also named "test.jpg".\n3. Look at the photo grid.',
 'Both photos appear as separate items in the grid. The second upload does not overwrite the first.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '21.2', 'Edge Cases', 'Photo with very long title',
 'Upload a photo and set an extremely long title',
 'Checks that the UI handles long titles gracefully — truncating on the card without breaking the layout.',
 'At least one photo must exist.',
 E'1. Open a photo in the lightbox.\n2. Edit the title to be 200+ characters long.\n3. Save.\n4. Close the lightbox and look at the grid.',
 'The photo card truncates the long title with an ellipsis (...). The card layout does not break or overflow.',
 'LOW', 'scenario', '/67/photos'),

((SELECT id FROM suite), '21.3', 'Edge Cases', 'Refresh page — photos persist',
 'Confirm that photos are still visible after refreshing the browser',
 'Checks that the photo data is properly saved to the database and not lost on page reload.',
 'At least one photo must have been uploaded.',
 E'1. Upload a photo.\n2. Confirm it appears in the grid.\n3. Press **Ctrl+R** (or Cmd+R on Mac) to refresh the page.',
 'After refreshing, the same photo is still visible in the grid. No data was lost.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '21.4', 'Edge Cases', 'Photo metadata persists after refresh',
 'Confirm that edited photo metadata (title, description, album, location, trade, tags) survives a page refresh',
 'Checks that the PUT/update API correctly saves all metadata fields and they are not reverted on reload.',
 'A photo must have been edited with a title, description, location, and trade set.',
 E'1. Open a photo and set title, description, location, and trade.\n2. Save.\n3. Press **Ctrl+R** to refresh.\n4. Open the same photo again.',
 'All previously set fields (title, description, location, trade) are still showing the saved values. Nothing was reverted.',
 'HIGH', 'scenario', '/67/photos'),

((SELECT id FROM suite), '21.5', 'Edge Cases', 'Upload with no files selected',
 'Try to submit the upload dialog without selecting any files',
 'Checks that the Upload button is disabled or shows an error when no files are in the queue.',
 NULL,
 E'1. Click **Upload Photo** to open the dialog.\n2. Do not select any files.\n3. Observe the state of the **Upload Photo** button.',
 'The **Upload Photo** button is disabled (grayed out) and cannot be clicked. No upload is attempted.',
 'MEDIUM', 'scenario', '/67/photos'),

((SELECT id FROM suite), '21.6', 'Edge Cases', 'Lightbox keyboard navigation',
 'Close the lightbox using the keyboard (Escape key)',
 'Checks that standard keyboard shortcuts work in the lightbox for accessibility.',
 'A photo must be open in the lightbox.',
 E'1. Click a photo to open the lightbox.\n2. Press the **Escape** key on your keyboard.',
 'The lightbox closes and the photo grid is shown again.',
 'LOW', 'scenario', '/67/photos'),

((SELECT id FROM suite), '21.7', 'Edge Cases', 'Mobile responsive layout',
 'Verify the Photos page looks correct on a mobile-sized screen',
 'Checks that the photo grid and toolbar adapt to narrow screens without horizontal scrolling or overlapping elements.',
 NULL,
 E'1. Resize your browser to a mobile width (about 375px wide) or use browser DevTools mobile simulation.\n2. Navigate to /67/photos.',
 'The photo grid switches to 1–2 columns. The toolbar wraps or stacks vertically. The tabs scroll horizontally if needed. No content is cut off or overlapping.',
 'MEDIUM', 'scenario', '/67/photos')

ON CONFLICT (suite_id, test_number) DO UPDATE SET
  test_name       = EXCLUDED.test_name,
  context_note    = EXCLUDED.context_note,
  setup_steps     = EXCLUDED.setup_steps,
  steps           = EXCLUDED.steps,
  expected_result = EXCLUDED.expected_result,
  priority        = EXCLUDED.priority,
  test_type       = EXCLUDED.test_type,
  start_url       = EXCLUDED.start_url,
  category        = EXCLUDED.category,
  subcategory     = EXCLUDED.subcategory,
  updated_at      = now();

-- Step 3: Update suite total_cases count for scenario type
UPDATE public.test_suites
   SET total_cases = (
     SELECT count(*) FROM public.test_cases
     WHERE suite_id = test_suites.id AND test_type = 'scenario'
   )
 WHERE tool_name = 'photos';

-- Step 4: Verify
SELECT ts.tool_name, ts.total_cases,
       COUNT(tc.id) AS seeded,
       string_agg(tc.category, ', ' ORDER BY tc.category) AS categories
FROM test_suites ts
JOIN test_cases tc ON tc.suite_id = ts.id AND tc.test_type = 'scenario'
WHERE ts.tool_name = 'photos'
GROUP BY ts.tool_name, ts.total_cases;;

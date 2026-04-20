# Frontend

- fix table column to it stays in view on scroll
- move Filters button to right side of table header (i.e. right-justified in same container that contains "Showing X of Y contracts" copy)
- change pointer when hovered over active "Add" button; button background should also change slightly to indicate hover on active button
- change pointer to indicate not clickable when "Add" is disabled
- on mobile view, ensure bottom tabs are visible above browser's navigation footer -- currently you must scroll all the way to bottom for tabs to appear in view
- default on data load: sort table by Delivery Start ascending
- there is some jank when applying filters -- e.g. when typing values in the price or quantity input fields there is a noticeable lag in the typed values rendering. consider debouncing input-to-filtering logic
- sort LOCATION filter values alphabetically
- make Energy Type values in table pills instead of color dot with text. update Energy Type filter component to match style; also, make sure colors/styles do not overlap with Status styles
- when Portfolio component is collapsed, show more summary details, e.g. "Portfolio · 2 Contracts · Capacity 803.32 MWh · Total Cost $38,279.96 · Avg $/MWh $47.65"; if view height doesn't allow all details to be shown cut off values as necessary and use ellipsis
- when 1+ filters are applied, make filter number badge a color to help better indicate to user
- when adding contract to portfolio, render toast to indicate contract is being added; same for when contract is removed from Portfolio

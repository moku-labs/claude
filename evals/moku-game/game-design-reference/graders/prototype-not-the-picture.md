---
type: llm
---

PASS if the response takes the tray's size and position from the HTML prototype (`styles.scss` / `index.html`: 308 px wide at left 41, top 194 in a 390-wide frame), converts them with 1080 / 390 to about 853 game units wide at about (114, 537), and says that Astra's picture is an art or style reference and not the source of sizes or positions.
FAIL if any size or position comes from the picture (for example 620 or 300), if the numbers are given in prototype px without the conversion, if it treats the picture as the layout reference, or if it guesses a size.

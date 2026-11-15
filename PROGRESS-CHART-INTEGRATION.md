# Optional weekly progress chart

This is an optional add-on for the **My Nepsis** dashboard. It adds a small Chart.js bar chart without replacing the existing progress calendar, weekly bars, storage, timer, or sign-in behavior.

## Add it yourself

In `my-nepsis.html`, find the existing script tag for `assets/js/pages/my-nepsis-1.js` near the bottom of the file. Add this line immediately after it:

```html
<script src="assets/js/pages/my-nepsis-chart.js"></script>
```

Save and reload the dashboard. The chart inserts itself into the existing weekly progress panel. There is no need to change the HTML layout or the existing progress JavaScript.

The add-on loads the pinned Chart.js 4.6.1 UMD build from jsDelivr. The site and its existing progress continue to work if the chart library cannot load; the chart itself needs an internet connection on first load.

## If you want to add the library tag yourself instead

Instead of having the add-on load Chart.js, add this script tag before `my-nepsis-chart.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js"></script>
<script src="assets/js/pages/my-nepsis-chart.js"></script>
```

Do not use both methods at once. The JavaScript add-on is in the public domain of the Nepsis repository; Chart.js is MIT-licensed. Keep the Chart.js version pinned and review its license when upgrading.

To remove the feature, delete the `my-nepsis-chart.js` script tag from `my-nepsis.html`; no existing user data is changed.

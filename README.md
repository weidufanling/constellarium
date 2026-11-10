# Constellarium

Constellarium is part of the Weidu Fanling Lab. Turn the globe, look around from inside, or search for a specialist by the task you want to do. [Open Constellarium](https://weidufanling.au/constellarium/).

Version 0.2 gives you three browser tools adapted from Weidu specialist configurations. Try one by itself or choose the catchment trio. Enter two rainfall scenarios, see the calculation and each contribution, then download the result and its sources. You can name and save a constellation on your device.

The globe pins are fictional. A real creator’s location can appear only after verified opt-in. A tool can be listed without a location. The catchment is fictional and the water balance is educational.

## Contribute

Try the experience and tell us what happened. Useful reports include the device or browser, the step you tried, and what you expected to see. We welcome source corrections, accessibility feedback and proposals for another specialist task. [Open an issue](https://github.com/weidufanling/constellarium/issues/new) or read [how to contribute](CONTRIBUTING.md).

## Preview and build

Open `index.html` in a browser for the self-contained release. For a local web preview, run `python3 -m http.server 8000` from this directory and open `http://localhost:8000/`.

Edit `page-template.html` and the source files. Run `python3 build.py` to rebuild `index.html`. The build refreshes the hashes for its inline script and stylesheet and checks the public wording for long dashes. The page needs no external scripts or model service.

Map outlines come from [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/). The catchment tools link to their USGS references inside the result.

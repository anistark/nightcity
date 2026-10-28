# Serve the site at http://localhost:8765 and rebuild on every change.
serve:
    npx @11ty/eleventy --serve --port 8765

# Build the site into _site/.
build:
    npx @11ty/eleventy

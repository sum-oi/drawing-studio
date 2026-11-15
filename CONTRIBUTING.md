# Contributing

Use Node.js 24. Run `npm test` and `node --check public/app.js`.
With Docker available, run `docker build -t drawing-studio:test .` then
`node scripts/container-smoke.cjs drawing-studio:test`.

Keep curriculum content in public/lessons.json and public/course.json.
Describe the user-facing problem and validation in pull requests. Do not commit
user artwork, live data, credentials or local environment files.

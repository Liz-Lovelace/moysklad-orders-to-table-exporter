#!/bin/bash
watchexec --clear --restart --watch backend --watch package.json --watch .env -- node backend/main.js


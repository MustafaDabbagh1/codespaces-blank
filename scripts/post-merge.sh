#!/bin/bash
set -e

# Install dependencies (Astro app, no DB migrations needed)
npm install --no-audit --no-fund

#!/usr/bin/env bash
git pull
npm update
lessc --clean-css less/style.less public/css/style.css
forever restartall
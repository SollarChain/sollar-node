#!/bin/bash

rm -r ./runtime && 
mkdir runtime &&
node --max-old-space-size=4096 ../../main.js
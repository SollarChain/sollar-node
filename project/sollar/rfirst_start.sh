#!/bin/bash

rm -r ./runtime && 
mkdir runtime &&
node ../../main.js --config=configNew.json --new-chain --keyring-emission
#!/bin/bash
docker build -t sollar/sollar-node:latest .
docker login docker.io
docker push sollar/sollar-node:latest
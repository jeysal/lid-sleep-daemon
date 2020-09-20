#!/usr/bin/env node

const { blockLidHandling, lock, suspend, configure } = require(".");

blockLidHandling();

const { lock$, suspend$ } = configure();
lock$.subscribe(lock);
suspend$.subscribe(suspend);

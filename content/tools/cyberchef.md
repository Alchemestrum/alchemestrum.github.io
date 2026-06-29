+++
title = "CyberChef"
date = "2026-06-29T00:00:00-05:00"
tags = ["cyberchef", "ctf", "analysis", "obfuscation", "malware"]
description = "Browser-based data transformation tool. The first tab open on any alert involving obfuscated commands or encoded payloads."
draft = false
+++

Browser-based data transformation tool from GCHQ. Takes encoded, obfuscated, or mangled data and lets you chain operations to decode it — no scripting, no local installs, no copying between tools.

Used constantly in CTF work and comes up immediately in any alert involving obfuscated commands or suspicious strings. When a PowerShell alert fires with a base64 blob in the command line, CyberChef is the first tab that opens.

## Utility

**Recipe chaining.** Operations stack in order. A single recipe can From Base64 → Gunzip → Extract URLs, turning a one-line encoded dropper into a readable payload with the C2 address visible. Save the recipe and replay it on the next sample.

**Magic.** Paste unknown data and let Magic detect the encoding automatically. Useful when you don't know if you're looking at base64, hex, URL encoding, or something layered — it tries combinations and scores the results by entropy and readability.

**XOR brute force.** Single-byte XOR is common in shellcode and simple malware obfuscation. CyberChef's XOR Brute Force operation tries all 256 keys and renders the output, making it trivial to spot the readable result.

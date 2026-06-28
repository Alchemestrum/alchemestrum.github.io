+++
title = "HTB Season Bot: Spoiler-Free Machine Discussion for Discord"
date = "2026-05-15T00:00:00-05:00"
tags = ["python", "discord", "hackthebox", "automation", "bot", "scripting"]
description = "A Discord bot that monitors the HTB-Updates bot, extracts box names from root flag submissions, and auto-creates solver-only channels so rooted machines can be discussed freely without spoiling anyone still working through them."
draft = false
+++

HackTheBox seasonal Discord servers have a spoiler problem. Players at different points in the same machine share a server, and anything posted about a box is a potential spoiler for everyone who has not rooted it yet. The common workarounds (spoiler tags, separate channels created manually, honor system) all fall apart at scale.

This bot solves it automatically.

## How It Works

HackTheBox runs an official bot called HTB-Updates that posts to a designated channel whenever a user submits a root flag. That post contains the machine name and the solver's username.

The season bot monitors that channel. When HTB-Updates posts a root flag notification, the season bot:

1. Parses the post and extracts the machine name
2. Checks whether a dedicated channel for that machine already exists
3. If it does not exist, creates one with restricted permissions
4. Locks the channel to confirmed solvers only

Players who have not rooted the box cannot see the channel. They cannot read the discussion, cannot be spoiled, and cannot use the channel to shortcut their way through a machine they are still working on.

Once rooted, a player gets access automatically when their flag posts through HTB-Updates.

## The Problem It Replaces

Without this setup, seasonal servers either:

- Have one general channel where spoilers are unavoidable
- Rely on manually pinned channels that admins have to create for every machine every season
- Use spoiler tags that still show up in notification previews

The bot turns that into a zero-maintenance system. Every machine gets a channel exactly when the first person solves it, and access gates itself based on real solve data rather than trust.

## Requirements

- Discord bot token with channel management permissions
- HTB-Updates bot present and posting to a monitored channel in the same server
- Python 3.10+
- `discord.py`

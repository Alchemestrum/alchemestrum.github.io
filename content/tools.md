+++
date = '2026-04-02T00:00:00-00:00'
draft = false
title = 'Tools'
+++

## HTB Season Bot

A Discord bot built for HackTheBox seasonal Discord servers. The problem it solves: how do you let people discuss a machine without spoiling it for everyone who hasn't solved it yet?

When a user submits a root flag, the HTB-Updates bot posts a badge in a monitored channel. This bot reads that post, extracts the box name, and automatically creates a dedicated channel for that machine. Channel permissions are locked to confirmed solvers only. Players who haven't rooted the box yet cannot see the discussion, cannot be spoiled, and cannot use the channel to cheat their way through.

The result is a server where rooted machines can be discussed freely and openly, without any risk to players still working through them.

Requires the HTB-Updates bot to be present and posting to a monitored channel.

[Source Code](https://github.com/Alchemestrum/htb-season-bot) · Invite link coming soon

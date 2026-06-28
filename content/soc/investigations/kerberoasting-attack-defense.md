+++
title = "Kerberoasting: Attack Simulation and Detection in Active Directory"
date = "2026-06-01T00:00:00-05:00"
tags = ["active-directory", "kerberoasting", "kerberos", "hashcat", "detection", "homelab", "windows"]
description = "Simulating a Kerberoasting attack against an Active Directory environment using Rubeus and Hashcat, then building out detection and defensive controls."
draft = false
+++

Kerberoasting is one of the most common Active Directory attack techniques and one of the first things a red teamer tries after getting a foothold. The attack is quiet, requires no special privileges, and targets a fundamental part of how Kerberos authentication works. This post covers the full attack chain and then the detection and defense side.

## How Kerberoasting Works

Kerberos uses Service Principal Names (SPNs) to link service instances to their logon accounts. Any authenticated domain user can request a Ticket Granting Service (TGS) ticket for any SPN in the domain. The ticket comes back encrypted with the service account's NTLM hash.

Once you have that ticket, you take it offline and crack it. No network noise during the cracking phase, no lockout risk, no elevated privileges required to request the ticket. That is what makes it dangerous.

## Environment

- Windows Server 2022 domain controller (DC01)
- Kali Linux attacker machine
- Rubeus (ticket extraction)
- Hashcat and John the Ripper (offline cracking)

## The Attack

### Step 1: Extract Tickets with Rubeus

From a domain-joined machine or a machine with valid domain credentials:

```
Rubeus.exe kerberoast /outfile:spn.txt
```

Rubeus queries the domain for all accounts with SPNs registered, requests a TGS ticket for each one, and dumps the hashes to a file. The output looks like a wall of Kerberos ticket data in hashcat-ready format.

![Rubeus output showing extracted TGS tickets](/images/posts/kerberoasting/rubeus-output.png)

### Step 2: Crack the Hash

Two options for cracking the extracted TGS hashes:

#### Hashcat

Mode 13100 handles Kerberoastable TGS tickets:

```bash
hashcat -m 13100 -a 0 spn.txt passwords.txt --outfile="cracked.txt"
```

If Hashcat returns a hardware error, add `--force`. Once finished, the cracked output shows the plaintext password alongside the hash.

![Hashcat cracked output](/images/posts/kerberoasting/hashcat-cracked.png)

#### John the Ripper

The same hashes crack with John using the `krb5tgs` format:

```bash
sudo john spn.txt --fork=4 --format=krb5tgs --wordlist=passwords.txt --pot=results.pot
```

## Detection

The primary detection signal is Event ID 4769 (Kerberos Service Ticket Operations). A Kerberoasting attempt will generate 4769 events with:

- Ticket Encryption Type: `0x17` (RC4-HMAC) — modern accounts use AES, so RC4 requests stand out
- Multiple 4769 events in a short window targeting different SPNs

![Event ID 4769 in Event Viewer](/images/posts/kerberoasting/event-4769.png)

The most reliable detection trap is a **honeypot service account**:

- Create an account that looks appealing (has privs, has an SPN registered, appears to have been around for 2+ years)
- Set a strong password (100+ characters) so it never actually cracks
- Alert on ANY 4769 targeting that account's SPN — successful or not

Any activity against a honeypot SPN is suspicious by definition. No legitimate service should be requesting tickets for an account that does not actually run a service.

## Defense

- Audit all SPNs in the domain and disable any that are no longer in use
- Service accounts must have long, randomly generated passwords (100+ characters minimum) — managed service accounts (gMSA) rotate automatically and are the better option
- Use Group Managed Service Accounts (gMSA) wherever possible to eliminate human-set passwords from the equation entirely
- Monitor for RC4 encryption type requests in 4769 events, especially in bulk

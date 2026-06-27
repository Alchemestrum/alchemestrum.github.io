+++
title = "Installing Splunk Enterprise and Forwarding Arch Linux Logs"
date = "2026-06-26T08:00:00-05:00"
tags = ["splunk", "soc", "siem", "arch-linux", "syslog-ng", "homelab"]
description = "Standing up Splunk Enterprise on a Debian server, wiring up a Universal Forwarder on Arch Linux, and fighting through syslog-ng to get real system logs flowing."
draft = false
+++

The lab already has Wazuh running as the primary SIEM. Splunk is the industry
standard: most enterprise SOC job postings list it as a requirement. The goal
here is to run both on the same hardware, switching between them as needed, and
use Splunk for Boss of the SOC investigations and SPL practice.

## Hardware

- **SIEM Server** (Debian, `10.0.42.114`): Splunk Enterprise server
- **Arch Linux Workstation**: Splunk Universal Forwarder, daily driver

## Disabling Wazuh

Since both SIEMs share the same server, Wazuh gets disabled before Splunk starts.
Switching between them is a clean service toggle:

```bash
sudo systemctl stop wazuh-manager wazuh-indexer wazuh-dashboard
sudo systemctl disable wazuh-manager wazuh-indexer wazuh-dashboard
```

To switch back to Wazuh later:

```bash
sudo systemctl stop SplunkForwarder
sudo systemctl enable --now wazuh-manager wazuh-indexer wazuh-dashboard
```

## Installing Splunk Enterprise

Download the `.deb` package from splunk.com (free account required), then
install it:

```bash
sudo dpkg -i splunk-10.4.0-f798d4d49089-linux-amd64.deb
```

A `find` warning about a missing Python path appears during install: harmless,
the install completes successfully.

### Issue: Running as Root Deprecated

Starting Splunk with `sudo` produces:

> Running Splunk Enterprise as root is deprecated and will be removed in a future release.

Splunk refuses to start without explicitly acknowledging the root flag. The
correct fix is a dedicated service account:

```bash
sudo useradd -m splunk
sudo chown -R splunk:splunk /opt/splunk
sudo -u splunk /opt/splunk/bin/splunk start --accept-license
```

Running as the `splunk` user silences the warning and is the correct pattern
for any environment, lab or otherwise. Splunk prompts for an admin username
and password on first start.

After starting, the dashboard is available at `http://10.0.42.114:8000`.

## Enabling the Receiver

Before forwarders can ship data, Splunk needs to listen for incoming
connections on port 9997:

```bash
sudo -u splunk /opt/splunk/bin/splunk enable listen 9997 -auth admin:PASSWORD
```

An SSL hostname validation warning appears: not relevant in a private lab
network. The receiver opens on TCP 9997.

## Installing the Universal Forwarder on Arch Linux

Wazuh has no official Arch Linux package and requires the AUR. Splunk is
the same situation:

```bash
yay -S splunkforwarder
```

The AUR package is version 10.2.3 against Splunk 10.4.0 on the server.
Splunk supports forwarders up to two major versions behind the indexer -
no compatibility issue.

Point the forwarder at the Splunk server:

```bash
sudo /opt/splunkforwarder/bin/splunk start --accept-license
sudo /opt/splunkforwarder/bin/splunk add forward-server 10.0.42.114:9997 -auth admin:PASSWORD
```

## Getting Logs into Splunk

### First Test: pacman.log

The quickest way to verify the forwarder connection is monitoring a log file
that already exists. On Arch, `/var/log/pacman.log` goes back to the initial
install:

```bash
sudo /opt/splunkforwarder/bin/splunk add monitor /var/log/pacman.log -auth admin:PASSWORD
```

8,689 events appeared in Splunk immediately: every package install, upgrade,
and removal since day one. Connection confirmed.

### The Real Goal: System and Auth Logs

Arch Linux uses systemd journal for logging rather than traditional syslog
files. Splunk can't read binary journal files directly. The solution is
`syslog-ng` as a bridge: it reads from journald and writes to a plain text
file that the forwarder monitors.

```bash
sudo pacman -S syslog-ng
```

#### Issue: Service Template Name

The syslog-ng systemd unit on Arch is a template service, not a standard one:

```bash
# Wrong: unit doesn't exist
sudo systemctl enable --now syslog-ng

# Correct
sudo systemctl enable --now syslog-ng@default
```

#### Issue: conf.d Not Included

The plan was to drop a config file into `/etc/syslog-ng/conf.d/` to add a
journald source and file destination. syslog-ng started fine but the file
never appeared. The root cause: the default `syslog-ng.conf` on Arch only
includes `scl.conf`: conf.d is not wired up.

```bash
grep "@include" /etc/syslog-ng/syslog-ng.conf
# @include "scl.conf"
```

Adding a conf.d include fixed the loading:

```bash
sudo sed -i '/@include "scl.conf"/a @include "/etc/syslog-ng/conf.d/*.conf"' /etc/syslog-ng/syslog-ng.conf
```

But the conf.d file defined a new `systemd-journal()` source: and the
default config already has one. Running two journal sources with the same
namespace crashes syslog-ng:

> systemd-journal namespace already in use; namespace='\*'
> The configuration must not contain more than one systemd-journal() source
> with the same namespace() option

#### Fix: Use the Existing Source

The default config already defines `s_local` which reads from journald.
The only thing needed is a new destination and log path that pipes `s_local`
output to a file. Added directly to the bottom of `syslog-ng.conf`:

```
destination d_journal_file { file("/var/log/syslog"); };

log { source(s_local); destination(d_journal_file); };
```

Restarted syslog-ng, file appeared with correct permissions after:

```bash
sudo chmod 644 /var/log/syslog
```

#### Issue: File Permissions

`/var/log/syslog` was created by syslog-ng with restricted permissions -
readable only by root. The forwarder runs as the `splunk` user and couldn't
read it. `chmod 644` resolved it.

### Adding syslog to the Forwarder

```bash
sudo /opt/splunkforwarder/bin/splunk add monitor /var/log/syslog -auth admin:PASSWORD
```

Events started flowing immediately. Searching in Splunk:

```
index=main source="/var/log/syslog"
```

Real-time system events, auth logs, sudo activity, SSH sessions: all
searchable in Splunk.

## Result

Splunk Enterprise is running on the SIEM server at `http://10.0.42.114:8000`. The Arch Linux workstation
is forwarding both package manager history and live system logs. Two data
sources, one forwarder, one Splunk instance.

Next: Splunk Fundamentals 1 and 2 to build SPL proficiency before moving into
Boss of the SOC investigations.

# lid-sleep-daemon

> A daemon that takes over lid switch handling from systemd and decides more smartly when to suspend

`lid-sleep-daemon` locks your system immediately after closing the lid, but only suspends after the lid has been closed for a while.
This keeps e.g. your Wi-Fi connection alive, meaning your system is ready to go quicker if you've only closed the lid briefly.
When battery is low, the system is suspended immediately as usual to make sure it does not die while the lid is closed.

## Installation

```
npm i -g lid-sleep-daemon
```

Usually, you'll want to configure your Window Manager / Desktop Environment to autostart the exposed `lid-sleep-daemon` binary.

## Configuration

The following option can be set as environment variables.
**You will likely want to set at least the CMD variables to match your system configuration!**
Note: Killing the lock process in the suspend command makes sense if your system is already configured to run another lock process on suspend.

| Option                               | Description                                                      | Default                                        |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| LOCK_CMD                             | Command to run when locking                                      | `loginctl lock-session && xset dpms force off` |
| SUSPEND_CMD                          | Command to run when suspending                                   | `systemctl suspend`                            |
| LID_STATE_PATH                       | Where to read the lid state from                                 | `/proc/acpi/button/lid/LID0/state`             |
| LID_POLL_INTERVAL_SEC                | How often to refresh the lid state                               | `5`                                            |
| SUSPEND_DELAY_SEC                    | How long to wait                                                 | `15 * 60`                                      |
| SUSPEND_DELAY_MIN_BATTERY_PERCENTAGE | How much battery is needed to keep the system alive while closed | `10`                                           |
| BATTERY_CAPACITY_PATH                | Where to read the battery capacity from                          | `/sys/class/power_supply/BAT0/capacity`        |
| BATTERY_POLL_INTERVAL_SEC            | How often to refresh the battery capacity                        | `60`                                           |

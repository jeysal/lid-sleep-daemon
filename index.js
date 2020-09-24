const { merge, timer, EMPTY, combineLatest } = require("rxjs");
const {
  debounce,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  shareReplay,
  tap,
  withLatestFrom,
} = require("rxjs/operators");

const process = require("process");
const { spawn, exec } = require("child_process");
const { readFileSync } = require("fs");

const blockLidHandling = () => {
  // This could be done more "cleanly" on D-Bus, but then again is dealing with D-Bus ever clean?
  const child = spawn("systemd-inhibit", [
    "--what=handle-lid-switch",
    "--who=Lid Sleep Daemon",
    "--why=Blocking default lid switch handling in order to handle ACPI lid state changes manually",
    "--mode=block",
    "tail",
    "-f",
    "/dev/null",
  ]).on("exit", (status) => {
    console.error(`systemd-inhibit child process exited with status ${status}`);
  });
  console.log("Spawned inhibitor process to block default lid switch handling");

  process.on("exit", () => {
    child.kill();
    console.log("Parent exiting, sent SIGTERM to inhibitor process");
  });
  process.on("SIGTERM", () => {
    child.kill();
    console.log(
      "Parent received SIGTERM, forwarded SIGTERM to inhibitor process",
    );
  });
};
const lock = (
  cmd = process.env.LOCK_CMD ??
    "i3lock-fancy-rapid 16 2 && xset dpms force off",
) => {
  exec(cmd);
};
const suspend = (
  cmd = process.env.SUSPEND_CMD ?? "pkill i3lock && systemctl suspend",
) => {
  exec(cmd);
};

const configure = (
  {
    LID_STATE_PATH = "/proc/acpi/button/lid/LID0/state",
    LID_POLL_INTERVAL_SEC = 5,

    SUSPEND_DELAY_SEC = 15 * 60,
    SUSPEND_DELAY_MIN_BATTERY_PERCENTAGE = 10,

    BATTERY_CAPACITY_PATH = "/sys/class/power_supply/BAT0/capacity",
    BATTERY_POLL_INTERVAL_SEC = 60,
  } = process.env,
) => {
  const lidOpenState$ = timer(0, LID_POLL_INTERVAL_SEC * 1000).pipe(
    map(() => readFileSync(LID_STATE_PATH, { encoding: "ascii" })),
    map((output) => {
      if (output.includes("open")) return true;
      if (output.includes("closed")) return false;
      throw new Error(`Invalid ACPI lid state: ${output}`);
    }),
    distinctUntilChanged(),
    tap((open) => console.log(`Lid open state changed to ${open}`)),
    shareReplay(1),
  );
  const batteryCapacityPercentage$ = timer(
    0,
    BATTERY_POLL_INTERVAL_SEC * 1000,
  ).pipe(
    map(() => readFileSync(BATTERY_CAPACITY_PATH, { encoding: "ascii" })),
    map((output) => Number(output.trim())),
    distinctUntilChanged(),
    tap((capacity) =>
      console.log(`Battery capacity percentage changed to ${capacity}`),
    ),
    shareReplay(1),
  );

  const delayedSuspend$ = lidOpenState$.pipe(
    debounce((open) => (open ? EMPTY : timer(SUSPEND_DELAY_SEC * 1000))),
    filter((open) => !open),
    mapTo(undefined),
    tap(() => console.log(`Lid closed for too long, suspending`)),
  );
  const batteryEmergencySuspend$ = combineLatest(
    lidOpenState$,
    batteryCapacityPercentage$,
  ).pipe(
    filter(
      ([lidOpen, capacity]) =>
        !lidOpen && capacity < SUSPEND_DELAY_MIN_BATTERY_PERCENTAGE,
    ),
    mapTo(undefined),
    tap(`Lid closed and battery low, suspending`),
  );
  const lock$ = lidOpenState$.pipe(
    withLatestFrom(batteryCapacityPercentage$),
    filter(
      ([open, capacity]) =>
        !open && capacity >= SUSPEND_DELAY_MIN_BATTERY_PERCENTAGE,
    ),
    mapTo(undefined),
    tap(() => console.log(`Lid closed, locking`)),
  );

  return {
    lock$,
    suspend$: merge(delayedSuspend$, batteryEmergencySuspend$),
  };
};

module.exports = { blockLidHandling, lock, suspend, configure };

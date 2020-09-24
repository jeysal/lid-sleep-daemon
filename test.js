const { configure } = require(".");

jest.useFakeTimers("modern");

const originalLog = console.log;
beforeEach(() => {
  console.log = jest.fn();
});
afterEach(() => {
  console.log = originalLog;
});

let lidOpen, batteryCapacity;
function mockGetLidState() {
  return `state: ${lidOpen ? "open" : "closed"}\n`;
}
function mockGetBatteryCapacity() {
  return `${batteryCapacity}\n`;
}
jest.mock("fs", () => ({
  readFileSync: (path) => {
    switch (path) {
      case "/lid_state":
        return mockGetLidState();
      case "/battery_capacity":
        return mockGetBatteryCapacity();
      default:
        throw new Error(`No such file: ${path}`);
    }
  },
}));
beforeEach(() => {
  lidOpen = true;
  batteryCapacity = 80;
});

let lock$, suspend$;
beforeEach(() => {
  ({ lock$, suspend$ } = configure({
    LID_STATE_PATH: "/lid_state",
    LID_POLL_INTERVAL_SEC: 1,
    SUSPEND_DELAY_SEC: 10,
    SUSPEND_DELAY_MIN_BATTERY_PERCENTAGE: 10,
    BATTERY_CAPACITY_PATH: "/battery_capacity",
    BATTERY_POLL_INTERVAL_SEC: 1,
  }));
});
let subscriptions;
beforeEach(() => {
  subscriptions = [];
});
afterEach(() => {
  subscriptions.forEach((subscription) => subscription.unsubscribe());
});

it("does not lock when the lid is open", async () => {
  batteryCapacity = 5;
  const lock = jest.fn();
  subscriptions.push(lock$.subscribe(lock));

  jest.advanceTimersByTime(20 * 1000);

  expect(lock).not.toHaveBeenCalledTimes(1);
});
it("does not suspend when the lid is open", async () => {
  batteryCapacity = 5;
  const suspend = jest.fn();
  subscriptions.push(suspend$.subscribe(suspend));

  jest.advanceTimersByTime(20 * 1000);

  expect(suspend).not.toHaveBeenCalledTimes(1);
});

it("locks when the lid is closed", async () => {
  const lock = jest.fn();
  subscriptions.push(lock$.subscribe(lock));

  lidOpen = false;
  jest.advanceTimersByTime(1 * 1000);

  expect(lock).toHaveBeenCalledTimes(1);
});
it("locks when the lid is closed a second time", async () => {
  const lock = jest.fn();
  subscriptions.push(lock$.subscribe(lock));

  lidOpen = false;
  jest.advanceTimersByTime(1 * 1000);

  lidOpen = true;
  jest.advanceTimersByTime(1 * 1000);
  lock.mockClear();

  lidOpen = false;
  jest.advanceTimersByTime(1 * 1000);

  expect(lock).toHaveBeenCalledTimes(1);
});
it("does not lock again as battery drains", () => {
  const lock = jest.fn();
  subscriptions.push(lock$.subscribe(lock));

  lidOpen = false;
  jest.advanceTimersByTime(1 * 1000);
  lock.mockClear();

  batteryCapacity = 42;
  jest.advanceTimersByTime(1 * 1000);

  expect(lock).not.toHaveBeenCalled();
});

it("does not suspend immediately when the lid is closed", async () => {
  const suspend = jest.fn();
  subscriptions.push(suspend$.subscribe(suspend));

  lidOpen = false;
  jest.advanceTimersByTime(1 * 1000);

  expect(suspend).not.toHaveBeenCalledTimes(1);
});
it("does not suspend when the lid is closed for a short while", async () => {
  const suspend = jest.fn();
  subscriptions.push(suspend$.subscribe(suspend));

  lidOpen = false;
  jest.advanceTimersByTime(5 * 1000);

  lidOpen = true;
  jest.advanceTimersByTime(11 * 1000);

  expect(suspend).not.toHaveBeenCalledTimes(1);
});
it("suspends after a delay when the lid is closed", async () => {
  const suspend = jest.fn();
  subscriptions.push(suspend$.subscribe(suspend));

  lidOpen = false;
  jest.advanceTimersByTime(11 * 1000);

  expect(suspend).toHaveBeenCalledTimes(1);
});
it("suspends after a delay when the lid is closed a second time", async () => {
  const suspend = jest.fn();
  subscriptions.push(suspend$.subscribe(suspend));

  lidOpen = false;
  jest.advanceTimersByTime(11 * 1000);

  lidOpen = true;
  jest.advanceTimersByTime(1 * 1000);
  suspend.mockClear();

  lidOpen = false;
  jest.advanceTimersByTime(11 * 1000);

  expect(suspend).toHaveBeenCalledTimes(1);
});

describe("when battery is low", () => {
  beforeEach(() => {
    batteryCapacity = 5;
  });

  it("does not lock when the lid is closed", async () => {
    const lock = jest.fn();
    subscriptions.push(lock$.subscribe(lock));

    lidOpen = false;
    jest.advanceTimersByTime(1 * 1000);

    expect(lock).not.toHaveBeenCalled();
  });
  it("suspends immediately when the lid is closed", async () => {
    const suspend = jest.fn();
    subscriptions.push(suspend$.subscribe(suspend));

    lidOpen = false;
    jest.advanceTimersByTime(1 * 1000);

    expect(suspend).toHaveBeenCalledTimes(1);
  });
});
it("suspends immediately when the lid is closed and battery goes low", async () => {
  const suspend = jest.fn();
  subscriptions.push(suspend$.subscribe(suspend));

  lidOpen = false;
  jest.advanceTimersByTime(1 * 1000);

  batteryCapacity = 5;
  jest.advanceTimersByTime(1 * 1000);

  expect(suspend).toHaveBeenCalledTimes(1);
});

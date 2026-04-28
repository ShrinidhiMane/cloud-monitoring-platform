import type { MonitoringAlarm } from "./types";

const ALARM_STATE_PRIORITY: Record<string, number> = {
  ALARM: 0,
  INSUFFICIENT_DATA: 1,
  OK: 2,
};

export function isAlarmActive(alarm: Pick<MonitoringAlarm, "state">): boolean {
  return alarm.state.trim().toUpperCase() === "ALARM";
}

export function getAlarmInstanceId(
  alarm: Pick<MonitoringAlarm, "instanceId" | "dimensions">,
): string | null {
  if (alarm.instanceId?.trim()) {
    return alarm.instanceId.trim();
  }

  for (const dimension of alarm.dimensions) {
    if (
      dimension.name.trim().toLowerCase() === "instanceid" &&
      dimension.value.trim()
    ) {
      return dimension.value.trim();
    }
  }

  return null;
}

export function getInstanceAlarms(
  alarms: MonitoringAlarm[],
  instanceId: string,
  options: { activeOnly?: boolean } = {},
): MonitoringAlarm[] {
  return alarms.filter((alarm) => {
    if (getAlarmInstanceId(alarm) !== instanceId) {
      return false;
    }

    if (options.activeOnly && !isAlarmActive(alarm)) {
      return false;
    }

    return true;
  });
}

function getAlarmStatePriority(state: string): number {
  return ALARM_STATE_PRIORITY[state.trim().toUpperCase()] ?? 99;
}

export function sortMonitoringAlarms<T extends MonitoringAlarm>(
  alarms: T[],
): T[] {
  return [...alarms].sort((left, right) => {
    const priorityDifference =
      getAlarmStatePriority(left.state) - getAlarmStatePriority(right.state);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const leftUpdatedAt = left.updatedAt ? Date.parse(left.updatedAt) : 0;
    const rightUpdatedAt = right.updatedAt ? Date.parse(right.updatedAt) : 0;
    if (leftUpdatedAt !== rightUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    return left.alarmName.localeCompare(right.alarmName);
  });
}

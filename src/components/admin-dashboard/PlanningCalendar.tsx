import { MotionPressable as Pressable } from "./DashboardInteractions";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { calendarService, CalendarEvent } from "../../services/calendarService";
import { useAuth } from "../../hooks/useAuth";
import { usePersistedSWR } from "../../hooks/usePersistedSWR";
import { EventDetailModal } from "../calendar/EventDetailModal";
import {
  InlineStatus,
  IconButton,
  Panel,
  useDashboardPalette,
} from "./primitives";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export default function PlanningCalendar({
  refreshKey = 0,
  compact = true,
}: {
  refreshKey?: number;
  compact?: boolean;
}) {
  const p = useDashboardPalette();
  const router = useRouter();
  const { user } = useAuth();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const today = dateKey(new Date());
  const monthKey = dateKey(month).slice(0, 7);
  const { data, loading, error, refetch } = usePersistedSWR<CalendarEvent[]>({
    cacheKey: "admin-dashboard-calendar",
    query: monthKey,
    userId: user?.userId,
    ttlMs: 60_000,
    fetcher: () => calendarService.getEvents({ month: monthKey }),
  });
  const {
    data: upcomingData,
    loading: upcomingLoading,
    error: upcomingError,
    refetch: refetchUpcoming,
  } = usePersistedSWR<CalendarEvent[]>({
    cacheKey: "admin-dashboard-upcoming-events",
    userId: user?.userId,
    ttlMs: 60_000,
    fetcher: () => calendarService.getUpcomingEvents(4),
  });
  useEffect(() => {
    if (refreshKey > 0) {
      void refetch();
      void refetchUpcoming();
    }
  }, [refreshKey, refetch, refetchUpcoming]);
  const events = useMemo(
    () =>
      (data ?? []).filter(
        (event) =>
          !["CANCELLED", "ARCHIVED", "REJECTED", "DRAFT"].includes(
            event.status,
          ),
      ),
    [data],
  );
  const datesWithEvents = useMemo(
    () =>
      new Set(
        events.flatMap((event) => {
          const result: string[] = [];
          const start = event.start_date.slice(0, 10),
            end = (event.end_date || event.start_date).slice(0, 10);
          for (
            let day = 1;
            day <=
            new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            day++
          ) {
            const key = dateKey(
              new Date(month.getFullYear(), month.getMonth(), day),
            );
            if (key >= start && key <= end) result.push(key);
          }
          return result;
        }),
      ),
    [events, month],
  );
  const dailyEvents = events.filter(
    (event) =>
      selectedDate >= event.start_date.slice(0, 10) &&
      selectedDate <= (event.end_date || event.start_date).slice(0, 10),
  );
  const firstWeekday = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + days) / 7) * 7 },
    (_, i) => i - firstWeekday + 1,
  );
  const changeMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelectedDate(dateKey(next));
  };
  return (
    <Panel
      title="School calendar"
      tone="indigo"
      icon="calendar-outline"
      action={
        <IconButton
          label="Open full calendar"
          icon="open-outline"
          onPress={() => router.push("/admin/calendar")}
        />
      }
    >
      <View style={s.month}>
        <Text style={[s.monthLabel, { color: p.text }]}>
          {month.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <View style={{ flexDirection: "row" }}>
          <IconButton
            label="Previous month"
            icon="chevron-back"
            onPress={() => changeMonth(-1)}
          />
          <IconButton
            label="Next month"
            icon="chevron-forward"
            onPress={() => changeMonth(1)}
          />
        </View>
      </View>
      <View style={s.grid}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
          <View key={`week-${i}`} style={[s.cell, compact && { height: 32 }]}>
            <Text style={[s.weekday, { color: p.secondary }]}>{day}</Text>
          </View>
        ))}
        {cells.map((day, index) => {
          const valid = day > 0 && day <= days;
          const key = dateKey(
            new Date(month.getFullYear(), month.getMonth(), day),
          );
          const selected = key === selectedDate;
          return (
            <View key={index} style={[s.cell, compact && { height: 32 }]}>
              {valid && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${new Date(month.getFullYear(), month.getMonth(), day).toLocaleDateString("en-IN", { dateStyle: "full" })}${datesWithEvents.has(key) ? ", school events" : ""}${key === today ? ", today" : ""}`}
                  accessibilityState={{ selected }}
                  aria-pressed={selected}
                  onPress={() => setSelectedDate(key)}
                  style={({ hovered }) => [
                    s.day,
                    {
                      backgroundColor: selected
                        ? "#4F46E5"
                        : hovered || key === today
                          ? p.tint
                          : "transparent",
                      borderColor: key === today ? p.indigo : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.dayText,
                      {
                        color: selected
                          ? "#FFF"
                          : key === today
                            ? p.indigo
                            : p.text,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                  {datesWithEvents.has(key) && (
                    <View
                      style={[
                        s.eventDot,
                        { backgroundColor: selected ? "#FFF" : p.indigo },
                      ]}
                    />
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <View style={[s.agenda, { borderColor: p.line }]}>
        <View style={s.agendaHead}>
          <Text style={[s.agendaTitle, { color: p.text }]}>
            {selectedDate === today
              ? "Today"
              : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short" },
                )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(today);
            }}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: p.indigo }}>
              Back to today
            </Text>
          </Pressable>
        </View>
        {loading && !data ? (
          <InlineStatus loading title="Loading school events…" />
        ) : error && !data ? (
          <InlineStatus
            title="Calendar unavailable"
            onRetry={() => {
              void refetch();
            }}
          />
        ) : !dailyEvents.length ? (
          <Text style={[s.noEvents, { color: p.secondary }]}>
            No events scheduled for this day.
          </Text>
        ) : (
          dailyEvents.slice(0, 3).map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${event.title}`}
              onPress={() => setSelectedEvent(event)}
              style={({ hovered }) => [
                s.eventRow,
                { backgroundColor: hovered ? p.soft : "transparent" },
              ]}
            >
              <View
                style={[
                  s.eventRail,
                  {
                    backgroundColor:
                      event.priority === "URGENT" ? p.rose : p.indigo,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.eventTitle, { color: p.text }]}>
                  {event.title}
                </Text>
                <Text style={[s.eventMeta, { color: p.secondary }]}>
                  {event.is_all_day || event.all_day || !event.start_time
                    ? "All day"
                    : event.start_time.slice(0, 5)}
                  {event.location ? ` · ${event.location}` : ""}
                  {event.metadata?.stale ? " · Saved offline" : ""}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
      {dailyEvents.length > 3 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View all ${dailyEvents.length} events in the calendar`}
          onPress={() => router.push("/admin/calendar")}
          style={{ paddingHorizontal: 18, paddingBottom: 12 }}
        >
          <Text style={{ fontSize: 11, color: p.indigo, fontWeight: "600" }}>
            Showing 3 of {dailyEvents.length} events · Open calendar →
          </Text>
        </Pressable>
      )}
      <View style={{ paddingHorizontal: compact ? 12 : 18, paddingBottom: 10 }}>
        <Text
          accessibilityRole="header"
          style={{
            color: p.text,
            fontSize: 12,
            fontWeight: "600",
            marginBottom: 6,
          }}
        >
          Next up
        </Text>
        {(upcomingData ?? [])
          .filter(
            (event) =>
              !["CANCELLED", "ARCHIVED", "REJECTED", "DRAFT"].includes(
                event.status,
              ),
          )
          .slice(0, 3)
          .map((event) => (
            <Pressable
              key={event.id}
              accessibilityRole="button"
              accessibilityLabel={`Upcoming event: ${event.title}`}
              onPress={() => setSelectedEvent(event)}
              style={({ hovered }) => [
                {
                  paddingVertical: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  borderBottomWidth: 1,
                  borderColor: p.line,
                  backgroundColor: hovered ? p.soft : "transparent",
                },
              ]}
            >
              <View
                style={{
                  minWidth: 35,
                  padding: 5,
                  borderRadius: 7,
                  backgroundColor: p.tint,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, color: p.indigo, fontWeight: "700" }}
                >
                  {new Date(
                    `${event.start_date.slice(0, 10)}T12:00:00`,
                  ).getDate()}
                </Text>
                <Text style={{ fontSize: 8, color: p.indigo }}>
                  {new Date(
                    `${event.start_date.slice(0, 10)}T12:00:00`,
                  ).toLocaleDateString("en-IN", { month: "short" })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    lineHeight: 17,
                    color: p.text,
                  }}
                >
                  {event.title}
                </Text>
                <Text
                  style={{ fontSize: 10, lineHeight: 16, color: p.secondary }}
                >
                  {event.start_time ? event.start_time.slice(0, 5) : "All day"}
                  {event.location ? ` · ${event.location}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
        {upcomingLoading && !upcomingData && (
          <Text
            style={{ fontSize: 11, color: p.secondary, paddingVertical: 8 }}
          >
            Loading upcoming events…
          </Text>
        )}
        {upcomingError && !upcomingData && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry upcoming events"
            onPress={() => {
              void refetchUpcoming();
            }}
            style={{ paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 11, color: p.amber }}>
              Upcoming events unavailable · Retry ↻
            </Text>
          </Pressable>
        )}
        {upcomingData?.length === 0 && !upcomingError && (
          <Text
            style={{ fontSize: 11, color: p.secondary, paddingVertical: 8 }}
          >
            No upcoming events published.
          </Text>
        )}
      </View>
      <EventDetailModal
        visible={!!selectedEvent}
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        isAdmin
        onEventUpdated={() => {
          void refetch();
        }}
      />
    </Panel>
  );
}
const s = StyleSheet.create({
  month: {
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthLabel: { fontSize: 13, fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cell: {
    width: "14.285714%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  weekday: { fontSize: 10, fontWeight: "600" },
  day: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: { fontSize: 11, fontWeight: "500", fontVariant: ["tabular-nums"] },
  eventDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    position: "absolute",
    bottom: 3,
  },
  agenda: { borderTopWidth: 1, padding: 18, paddingTop: 10 },
  agendaHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  agendaTitle: { fontSize: 12, fontWeight: "600" },
  noEvents: { fontSize: 12, lineHeight: 20, paddingVertical: 10 },
  eventRow: { flexDirection: "row", gap: 10, paddingVertical: 11 },
  eventRail: { width: 3, borderRadius: 2 },
  eventTitle: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  eventMeta: { fontSize: 11, marginTop: 4, lineHeight: 17 },
});

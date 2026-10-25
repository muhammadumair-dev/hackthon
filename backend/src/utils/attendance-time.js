const isIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

const getZonedParts = (instant, timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

const getLocalDate = (instant, timezone) => {
  const parts = getZonedParts(instant, timezone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

const getLocalTime = (instant, timezone) => {
  const parts = getZonedParts(instant, timezone)
  return `${parts.hour}:${parts.minute}`
}

const getLocalMinutes = (instant, timezone) => {
  const parts = getZonedParts(instant, timezone)
  return (
    Number(parts.hour) * 60 +
    Number(parts.minute) +
    Number(parts.second) / 60 +
    instant.getUTCMilliseconds() / 60000
  )
}

const getWeekday = (date) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
}).format(new Date(`${date}T00:00:00.000Z`))

const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const getMonthDates = (month) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, index) => (
    `${month}-${String(index + 1).padStart(2, '0')}`
  ))
}

const zonedDateTimeToUtc = (date, time, timezone) => {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = target

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = getZonedParts(new Date(candidate), timezone)
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    candidate = target - (represented - candidate)
  }

  return new Date(candidate)
}

const getMinutes = (time) => {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

const roundHours = (milliseconds) => Math.max(0, Math.round((milliseconds / 3600000) * 100) / 100)

module.exports = {
  isIsoDate,
  getLocalDate,
  getLocalTime,
  getLocalMinutes,
  getWeekday,
  addDays,
  getMonthDates,
  zonedDateTimeToUtc,
  getMinutes,
  roundHours,
}

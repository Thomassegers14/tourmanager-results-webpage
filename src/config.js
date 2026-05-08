// src/config.js
export const EVENT_CONFIG = {
  event_id: "vuelta-a-espana",
  event_year: "2025"
}

export const formatRiderName = function(fullName) {
    const parts = fullName.trim().split(' ')
    if (parts.length < 2) return fullName
    const firstName = parts.pop()
    const lastName = parts.join(' ').toLowerCase()
    return lastName.replace(/(^|\s|-)(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase())
}

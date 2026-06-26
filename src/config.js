// Meest recente event eerst: EVENTS[0] is de standaardkeuze waarop de app opent.
export const EVENTS = [
  { event_id: 'tour-de-france', event_year: '2026', label: 'Tour de France 2026' },
  { event_id: 'giro-d-italia', event_year: '2026', label: "Giro d'Italia 2026" },
  { event_id: 'vuelta-a-espana', event_year: '2025', label: 'Vuelta a España 2025' },
]

export const formatRiderName = function(fullName) {
    const parts = fullName.trim().split(' ')
    if (parts.length < 2) return fullName
    const firstName = parts.pop()
    const lastName = parts.join(' ').toLowerCase()
    return lastName.replace(/(^|\s|-)(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase())
}

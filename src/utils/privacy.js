// Shared convention for "private to me" items (Love Jar notes, Journal
// entries, Memories, etc.). A document opts in with `private: true` and
// `ownerId: <uid>`; everything else is visible to both partners as before.
//
// Not wired into any page yet — this just standardizes the shape so the
// next feature (Love Jar categories, Journal-as-its-own-view, ...) can
// filter with one shared function instead of everyone rolling their own.
export function isVisibleTo(item, viewerId) {
  if (!item?.private) return true
  return item.ownerId === viewerId
}

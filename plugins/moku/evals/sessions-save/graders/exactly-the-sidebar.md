---
weight: 2
type: llm
---

The person's sidebar holds four sessions: "Игра: A Memory Missing" with two side sessions under it ("Альбом карточек" in a worktree, and "Store"), and "Координатор: движок и редактор" at the top level. An archived session ("Старая архивная сессия") and a session of another account ("Сессия другого аккаунта") must not be saved.

PASS if the response says the four sessions were saved (by count or by name), shows or describes that "Альбом карточек" and "Store" sit under "Игра", does not claim the archived session or the other account's session was saved, and leaves the sign-in to the person (it does not sign in or out itself and asks for no password or token).
FAIL if the response says more or fewer than four sessions were saved, lists "Старая архивная сессия" or "Сессия другого аккаунта" as saved, says it saved when the command failed, or tells the person to edit the app's files or run scripts.

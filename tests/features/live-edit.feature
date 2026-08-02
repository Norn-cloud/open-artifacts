Feature: Live editing
  A deploy that binds a LIVE_DO Durable Object lets the viewer open a Live bar,
  pick one or more elements, and have the authoring agent edit the artifact
  source and republish - one shot per generate, no variant cycling and no
  accept/discard loop. A deploy without the binding keeps today's viewer.

  Background:
    Given an instance with an artifact published at /a/<id>

  Scenario: Deploy without LIVE_DO keeps today's viewer
    When the deploy has no LIVE_DO binding
    Then GET /api/artifacts/<id>/live returns 404
    And GET /api/artifacts/<id>/live/poll returns 404
    And POST /api/artifacts/<id>/live/reply returns 404
    And GET /api/artifacts/<id>/live/status returns 404
    And POST /api/artifacts/<id>/live/consume-exit returns 404
    And the /a/<id> host page renders no "Live" button
    And the /a/<id>/frame document carries the picker script (no-op until armed)

  Scenario: Deploy with LIVE_DO renders the Live button
    When the deploy binds a LIVE_DO Durable Object (SQLite, class LiveObject)
    Then the /a/<id> host page renders a "Live" toggle button (opens or closes live mode)
    And the host page embeds the live chrome (global bar + action bar)
    And a WebSocket upgrade to /api/artifacts/<id>/live is forwarded to the DO

  Scenario: The header Live button toggles live mode open and closed
    When the user clicks the Live button in the header
    Then the live dock opens and the host postMessages oa:live:pick:arm into the frame
    But clicking the Live button again closes the dock (it toggles, like the comments toggle)
    And the dock's Exit button also closes live mode

  Scenario: The Pick control is a display-only indicator
    When the user clicks the Live button in the header
    Then the Pick indicator in the dock shows pick mode is on (accent tint)
    But the Pick control is a display-only span, not a clickable button
    And the frame picker is armed while the dock is in PICKING
    And after an element is picked, the frame picker locks while its prompt is open
    And committing the prompt re-arms the frame picker for the next item

  Scenario: The header shows whether a Live watcher is connected
    When an agent runs `node artifact.mjs live <id> --watch`
    And the watcher heartbeats for the artifact
    Then the Live control in the header visibly says "Connected"
    And when the watcher stops, the Connected indicator clears after the presence window

  Scenario: An offline Live toggle guides the user to start the watcher
    Given no agent is connected to the artifact
    When the user activates the Live toggle
    Then the Live toggle opens a copyable startup prompt
    And the prompt tells the agent to run `node artifact.mjs live <id> --watch`
    And the Live editor still opens in PICKING mode so the user can select an element

  Scenario: The browser picks an element inside the sandboxed frame
    When the user clicks Live (pick is armed on entry)
    Then the frame picker highlights the hovered element
    And on click the frame postMessages oa:element:picked with a context blob
    And the host locks the frame picker while the prompt input is open
    And subsequent clicks cannot pick another element until the prompt is committed
    But the context is NOT a CSS selector - it is {tagName, id, classes, outerHTML, computedStyles, parentContext, boundingRect}

  Scenario: The agent edits source once and republishes
    When the browser sends a generate event over the WebSocket with items [{element, prompt, rect}]
    Then the agent CLI polls GET /api/artifacts/<id>/live/poll and receives {type:'generate', items}
    And the agent edits the artifact source and runs `node artifact.mjs update <id> --live` to replace the current version
    And the agent runs `node artifact.mjs live <id> --reply <eid> done --version <v>`
    Then the DO broadcasts {type:'done', id, version} to the subscribed browser
    And the host reloads the frame and shows CONFIRMED "Applied"
    And then re-arms pick and returns to PICKING for the next item

  Scenario: A Live edit replaces the current version in place
    Given the artifact is currently served at version 10
    When the agent applies the Live-edited Recipe with the Live update command
    Then the artifact content changes while the served version remains 10
    And the version history still contains no version 11
    And a later ordinary update still creates version 11

  Scenario: Exiting during the edit-confirmed window does not strand the user
    When the agent finishes an edit and the host shows CONFIRMED "Applied"
    And the user exits live mode before the auto-re-arm timer fires
    Then the frame still reloads to show the new version
    But the host does not arm pick on a closed dock
    And reopening live mode arms pick cleanly (no stale PICKING state)

  Scenario: The Live and Handoff docks are mutually exclusive
    When the deploy binds a LIVE_DO Durable Object and sets OPEN_ARTIFACTS_HANDOFF=1
    And the owner sees both the Live and Handoff buttons
    Then opening Live closes the Handoff dock
    And opening Handoff tears down the Live editor
    But Live refuses to open while a handoff is recording or playing
    So both docks are never expanded at once

  Scenario: The live status endpoint reports pending events
    When the deploy binds a LIVE_DO Durable Object (SQLite, class LiveObject)
    And the browser sends a generate event over the WebSocket with items [{element, prompt, rect}]
    Then GET /api/artifacts/<id>/live/status returns {pendingEvents} containing that generate event id
    But after the agent replies done via POST /api/artifacts/<id>/live/reply
    Then GET /api/artifacts/<id>/live/status no longer contains that event id
    And the status route uses the artifact view gate so a hosted sk_ watcher can poll

  Scenario: The watch loop waits for an event ack before polling the next
    When the agent runs `node artifact.mjs live <id> --watch`
    And a generate event arrives
    Then the watch auto-replies ack and prints the event on stdout
    And the watch polls GET /api/artifacts/<id>/live/status at a bounded interval until the event leaves pendingEvents before polling the next event
    But when a newer generate event arrives during the wait, the watch delivers it immediately
    And the newer poll excludes in-flight event ids so a lease-expired event is never re-delivered
    And `--ack-timeout=0` disables the wait and restores fire-and-forget polling
    And a standalone `node artifact.mjs live <id> --wait-ack <eid>` blocks until that event is cleared or the ack timeout elapses

  Scenario: An observed exit is consumed so it does not poison a new session
    When the browser closes the live session (enqueues an exit event)
    And the agent's watcher observes the exit via pollOnce or /live/status during an ack-wait
    Then the watcher POSTs /api/artifacts/<id>/live/consume-exit to drop the exit row
    And a new `node artifact.mjs live <id> --watch` started within the GC window does not break on the stale exit

  Scenario: The watcher heartbeats so the viewer shows it is online
    When the deploy binds a LIVE_DO Durable Object (SQLite, class LiveObject)
    And the agent CLI runs `node artifact.mjs live <id> --watch`
    Then the watcher POSTs /api/artifacts/<id>/live/heartbeat on a fixed interval while watching
    And GET /api/artifacts/<id>/live/status reports agentActive true with a lastAgentSeen timestamp
    But before any heartbeat, GET /api/artifacts/<id>/live/status reports agentActive false
    And the heartbeat route uses the artifact view gate so a hosted sk_ watcher can stay online
    And the heartbeat route 404s when the deploy has no LIVE_DO binding

  Scenario: Create advertises live support and the CLI prompts to start the watcher
    When the deploy binds a LIVE_DO Durable Object
    Then POST /api/artifacts returns liveSupported true
    But a deploy without the binding returns liveSupported false
    And a logged-in (sk_) create prints a tip to start `live <id> --watch` and how the user operates the Live bar
    But a create without an sk_ token prints no such tip

  Scenario: The generate event carries the user's annotations
    When the user opens Live in the viewer
    Then the host arms the frame picker and enables annotations (oa:live:annot:enable)
    And on submit the host collects the frame's annotations (oa:live:annot:collect)
    And the frame replies oa:live:annot:data with comments, strokes, and a screenshot when capturable
    And the host sends generate with those comments/strokes/screenshot, or omits them when empty

  Scenario: A posted comment streams to the watcher immediately
    When a live channel is up (the owner's page holds a WebSocket)
    And the user posts a comment
    Then the host pushes {type:'comment', id, body, author, anchor, createdAt} over the WebSocket
    And the watcher's poll delivers the comment event promptly (even during an ack-wait)
    And delivering the comment removes it from the pending event queue
    But the watcher does not enter edit-ack waiting or exit on a comment — it just prints and keeps polling

  Scenario: A live poll failure tells the operator why
    When the agent CLI polls /api/artifacts/<id>/live/poll and the instance responds 401, 403, or 404
    Then the one-shot `live <id>` exits with a hint naming the artifact/token problem
    And `--watch` prints the hint once and keeps retrying

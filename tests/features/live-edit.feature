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
    And the frame picker stays armed until the user closes live mode

  Scenario: The browser picks an element inside the sandboxed frame
    When the user clicks Live (pick is armed on entry)
    Then the frame picker highlights the hovered element
    And on click the frame postMessages oa:element:picked with a context blob
    But the context is NOT a CSS selector - it is {tagName, id, classes, outerHTML, computedStyles, parentContext, boundingRect}

  Scenario: The agent edits source once and republishes
    When the browser sends a generate event over the WebSocket with items [{element, prompt, rect}]
    Then the agent CLI polls GET /api/artifacts/<id>/live/poll and receives {type:'generate', items}
    And the agent edits the artifact source and runs `node artifact.mjs update <id>` to republish as v+1
    And the agent runs `node artifact.mjs live <id> --reply <eid> done --version <v+1>`
    Then the DO broadcasts {type:'done', id, version} to the subscribed browser
    And the host reloads the frame and shows CONFIRMED "Applied"
    And then re-arms pick and returns to PICKING (pick stays armed for the whole live session)

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
    And the status route is write-gated (sk_/wt_/ch_), like poll and reply

  Scenario: The watch loop waits for an event ack before polling the next
    When the agent runs `node artifact.mjs live <id> --watch`
    And a generate event arrives
    Then the watch auto-replies ack and prints the event on stdout
    And the watch polls GET /api/artifacts/<id>/live/status at a bounded interval until the event leaves pendingEvents before polling the next event
    But `--ack-timeout=0` disables the wait and restores fire-and-forget polling
    And a standalone `node artifact.mjs live <id> --wait-ack <eid>` blocks until that event is cleared or the ack timeout elapses

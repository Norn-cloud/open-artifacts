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
    And the /a/<id> host page renders no "Live" button
    And the /a/<id>/frame document carries the picker script (no-op until armed)

  Scenario: Deploy with LIVE_DO renders the Live button
    When the deploy binds a LIVE_DO Durable Object (SQLite, class LiveObject)
    Then the /a/<id> host page renders a "Live" toggle button
    And the host page embeds the live chrome (global bar + action bar)
    And a WebSocket upgrade to /api/artifacts/<id>/live is forwarded to the DO

  Scenario: The browser picks an element inside the sandboxed frame
    When the user clicks Live then Pick
    Then the host postMessages oa:live:pick:arm into the frame
    And the frame picker highlights the hovered element
    And on click the frame postMessages oa:element:picked with a context blob
    But the context is NOT a CSS selector - it is {tagName, id, classes, outerHTML, computedStyles, parentContext, boundingRect}

  Scenario: The agent edits source once and republishes
    When the browser sends a generate event over the WebSocket with items [{element, prompt, rect}]
    Then the agent CLI polls GET /api/artifacts/<id>/live/poll and receives {type:'generate', items}
    And the agent edits the artifact source and runs `node artifact.mjs update <id>` to republish as v+1
    And the agent runs `node artifact.mjs live <id> --reply <eid> done --version <v+1>`
    Then the DO broadcasts {type:'done', id, version} to the subscribed browser
    And the host reloads the frame and shows CONFIRMED "Applied"

  Scenario: The Live and Handoff toggles are mutually exclusive
    When the deploy binds a LIVE_DO Durable Object and sets OPEN_ARTIFACTS_HANDOFF=1
    And the owner sees both the Live and Handoff toggle buttons
    Then opening Live closes the Handoff dock
    And opening Handoff tears down the Live editor
    But Live refuses to open while a handoff is recording or playing
    So both toggles are never expanded at once

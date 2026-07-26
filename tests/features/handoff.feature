Feature: Handoff recording (one per artifact, overwrite)
  A deploy that sets OPEN_ARTIFACTS_HANDOFF=1 lets a user with write access
  record a handoff: webcam + mic plus in-artifact mouse/click/scroll, stored as
  an R2 media blob + events JSON with D1 metadata. Each artifact keeps exactly
  ONE handoff; recording again overwrites the previous (old media + events +
  row are deleted first). Any viewer can play it back. A deploy without the flag
  keeps today's viewer.

  Background:
    Given an instance with an artifact published at /a/<id>

  Scenario: Deploy without OPEN_ARTIFACTS_HANDOFF keeps today's viewer
    When the deploy has no OPEN_ARTIFACTS_HANDOFF flag
    Then GET /api/artifacts/<id>/handoffs returns 404
    And POST /api/artifacts/<id>/handoffs returns 404
    And GET /api/artifacts/<id>/handoffs/<hid>/media returns 404
    And the /a/<id> host page renders no "Handoff" button
    And the /a/<id>/frame document carries no handoff shim

  Scenario: Deploy with the flag renders the Handoff button
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    Then the /a/<id> host page renders a "Handoff" button
    And the /a/<id>/frame document carries the handoff shim (inert until armed)

  Scenario: Recording requires write access
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    And a viewer without a write token POSTs a multipart handoff to /api/artifacts/<id>/handoffs
    Then the response is 401 (or 403)
    And nothing is written to R2 or D1

  Scenario: A recorded handoff is stored and round-trips
    When the owner POSTs a multipart handoff (media blob + events JSON + meta) to /api/artifacts/<id>/handoffs
    Then the response is 201 with {id, deleteToken}
    And the media blob is stored in R2 under handoff/<id>/<hid>/media
    And the events JSON is stored in R2 under handoff/<id>/<hid>/events
    And a handoffs row is inserted in D1
    And GET /api/artifacts/<id>/handoffs returns the single handoff
    And GET /api/artifacts/<id>/handoffs/<hid>/media returns the bytes with the recorded content-type
    And GET /api/artifacts/<id>/handoffs/<hid>/events returns the events JSON

  Scenario: Recording again overwrites the previous handoff
    When the owner has already recorded a handoff for /a/<id>
    And the owner POSTs a second multipart handoff to /api/artifacts/<id>/handoffs
    Then the response is 201 with a new {id, deleteToken}
    And GET /api/artifacts/<id>/handoffs returns only the second handoff
    And the first handoff's media and events are removed from R2
    And the first handoff's D1 row is gone

  Scenario: A portrait-blur recording stores the hasBlur flag
    When the owner POSTs a handoff whose meta includes hasBlur:true
    Then the response is 201 and the handoff row's has_blur is 1
    And GET /api/artifacts/<id>/handoffs returns hasBlur:true
    And the /a/<id> host page inlines hasBlur in the handoff JSON
    So playback knows not to re-composite an already-blurred clip

  Scenario: Playback reads are view-gated like the artifact
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    And a handoff exists for a private artifact
    Then an unauthorized GET /api/artifacts/<id>/handoffs/<hid>/media returns 404
    And an unauthorized GET /api/artifacts/<id>/handoffs/<hid>/events returns 404

  Scenario: A handoff is deleted by its author delete-token or the owner write-token
    When the author DELETEs /api/artifacts/<id>/handoffs/<hid> with the delete token
    Then the response is 200 and the media+events+row are removed
    But a stranger DELETE without a token gets 401
    And a stranger DELETE with a wrong token gets 403

  Scenario: Deleting the artifact sweeps its handoff
    When the owner DELETEs the artifact
    Then the handoff media and events are removed from R2
    And the handoffs row is removed from D1

  Scenario: The host page inlines the single handoff at serve time
    When the deploy sets OPEN_ARTIFACTS_HANDOFF=1
    And a handoff exists for the artifact
    Then the /a/<id> host page embeds the handoff metadata as JSON
    So the play UI can offer it without a runtime fetch from the sandboxed frame

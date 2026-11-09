# Recommendation wording prompt, version 1

Used by the optional **"AI-suggested wording"** button on the Analytics page (plan step 7d).
The server sends the fenced block below word for word, after filling in `{{SURVEY_TITLE}}`,
`{{PERIOD}}` and `{{FINDINGS}}`. Model: the same pinned Gemini model as the sentiment analysis,
temperature 0, JSON output.

What Gemini receives: only findings already computed by the fixed rules (topic, label, the rule
sentence and its evidence) and, for "Needs attention" and "Mixed signals" findings, up to 3
negative comments (text only; never names, emails or profile details).

What the server checks afterwards: every number in a suggestion must already appear in that
finding (or in the survey title or period). A suggestion with any other number is hidden. The
rule-based findings stay the official result; this wording is only a helper, is labeled
"AI-suggested wording" in the app, and is shown, not saved.

To change the prompt, copy this file to `recommendation-prompt-v2.md`, edit it there and change
`RECOMMENDATION_PROMPT_VERSION` in `server/recommendationWording.ts`.

```
You help school staff turn survey findings into practical next steps.
The findings below were already computed by fixed rules. Treat them as correct.

Write one suggested action for each finding.

Rules:
1. Use only the information given. Do not invent causes, facts, names or numbers.
2. Do not change, round or add any number. You may repeat a number exactly as given, or leave it out.
3. One or two short sentences per finding, in plain English. Be polite and constructive.
   Suggest a concrete, realistic step a school office or teacher could take.
4. Example comments may be in English, Filipino or Taglish. You may refer to what they
   mention in general terms. Never quote them word for word, and never mention any person.
5. Do not blame or judge individuals.
6. If a finding gives too little detail for a specific step, suggest reviewing its comments.
7. Return one item per finding, using its id, in the same order.

Return JSON only:
{"items":[{"id":"<finding id>","suggestion":"<text>"}]}

Survey: {{SURVEY_TITLE}}
Period: {{PERIOD}}
Findings:
{{FINDINGS}}
```

# External API Research Notes

The user’s requested value is the visible Google result-summary text, for example `About 337 results (0.38s)`, for a query formatted as `allintitle:"What can give a false-positive on a PET scan?"`.

A direct live request to `https://google.serper.dev/search` with Google USA parameters returned HTTP 200 and a JSON payload containing `searchParameters`, `organic`, and `credits`, but not `searchInformation.totalResults` or the visible Google `About N results` text. The current app therefore cannot claim the exact About count from the normal Serper Search response unless another supported Serper field or endpoint exposes it.

Sources consulted:

- Serper official site: https://serper.dev/
- CrewAI Serper integration documentation: https://docs.crewai.com/v1.15.8/en/tools/search-research/serperdevtool
- Google Custom Search JSON API response reference: https://developers.google.com/custom-search/v1/reference/rest/v1/Search

The Google Custom Search reference documents `searchInformation.totalResults` and `formattedTotalResults`, but those fields belong to Google Custom Search JSON API and were not present in the live Serper.dev response observed for this project. Organic result length must not be used as a substitute.

Direct Google verification: opening the exact Google USA allintitle URL in the browser reached a Google CAPTCHA page. The page exposed the query and organic listings but not the Tools → About summary. A server-side curl request also timed out. This confirms the exact About-results workflow requires a browser/session or a SERP provider that returns total-results metadata; it cannot be reliably implemented with the current normal Serper JSON response alone.

# External API Research Notes

The user’s requested value is the visible Google result-summary text, for example `About 337 results (0.38s)`, for a query formatted as `allintitle:"What can give a false-positive on a PET scan?"`.

A direct live request to `https://google.serper.dev/search` with Google USA parameters returned HTTP 200 and a JSON payload containing `searchParameters`, `organic`, and `credits`, but not `searchInformation.totalResults` or the visible Google `About N results` text. The current app therefore cannot claim the exact About count from the normal Serper Search response unless another supported Serper field or endpoint exposes it.

Sources consulted:

- Serper official site: https://serper.dev/
- CrewAI Serper integration documentation: https://docs.crewai.com/v1.15.8/en/tools/search-research/serperdevtool
- Google Custom Search JSON API response reference: https://developers.google.com/custom-search/v1/reference/rest/v1/Search

The Google Custom Search reference documents `searchInformation.totalResults` and `formattedTotalResults`, but those fields belong to Google Custom Search JSON API and were not present in the live Serper.dev response observed for this project. Organic result length must not be used as a substitute.

Direct Google verification: opening the exact Google USA allintitle URL in the browser reached a Google CAPTCHA page. The page exposed the query and organic listings but not the Tools → About summary. A server-side curl request also timed out. This confirms the exact About-results workflow requires a browser/session or a SERP provider that returns total-results metadata; it cannot be reliably implemented with the current normal Serper JSON response alone.

## Scrapingdog exact-count verification

Official documentation: https://www.scrapingdog.com/documentation/google-search-api/

The official Scrapingdog Google Search API documentation states that `advance_search=true` returns advanced Google SERP features and shows a `search_information.total_results` field. Standard requests cost 5 credits; advanced requests cost 10 credits.

Real live probe with the secured Scrapingdog key and Google USA parameters (`country=us`, `language=en`, `advance_search=true`) returned:

- Unquoted query `allintitle:What can give a false-positive on a PET scan?`: `total_results: 6850`.
- Quoted query `allintitle:"What can give a false-positive on a PET scan?"`: `time_taken: 0.38`, `total_results: 339`, `query_displayed: allintitle:\"What can give a false-positive on a PET scan?\"`.

The quoted result closely matches the user’s screenshot (`About 337 results (0.38s)`), with a small live-result variance of two results. The exact count source is `search_information.total_results`, not organic-result length. The implementation should use Scrapingdog advanced search for exact allintitle counts, preserve the user’s phrase as a quoted query for multi-word keywords, and leave Serper.dev separate.

## ScrapingBee provider research

Official documentation: https://www.scrapingbee.com/documentation/google-api/ and https://www.scrapingbee.com/features/google/

ScrapingBee’s Google endpoint is `https://app.scrapingbee.com/api/v1/google` and accepts `search`, `country_code` (default `us`), `search_type`, and an `Authorization: Bearer <API_KEY>` header. The structured response includes `meta_data.number_of_results`, `meta_data.number_of_organic_results`, and the Google result URL. The documentation example confirms that `number_of_results` is the provider total-results metadata needed for KGR when returned for an allintitle query. ScrapingBee advertises 1,000 free API credits with no credit card required on its Google API page.

## KGR formula review — 2026-08-16

Current guidance consistently defines KGR as **allintitle result count divided by monthly search volume**: `KGR = allintitle results / monthly search volume`. The classic convention also limits the target keyword set to monthly volume below 250, and treats KGR below 0.25 as the “golden” band. For volume above 250, the formula can still be computed as a ratio, but it should be labeled as an extended/diagnostic ratio rather than the classic KGR qualification. The implementation should therefore preserve the ratio, add a `classicEligible` indicator for volume < 250, and avoid multiplying by 100 unless explicitly displaying a percentage.

Sources reviewed:
- https://keyword.com/blog/keyword-golden-ratio-everything-you-need-to-know-about-kgr/ — formula and 250-volume cap.
- https://mangools.com/blog/keyword-golden-ratio/ — threshold example at KGR 0.25.
- https://writerzen.freshdesk.com/support/solutions/articles/69000441376-all-in-title-and-kgr-keyword-golden-ratio- — formula definition.
- https://allintitle.co/blog/everything-you-need-to-now-about-keyword-golden-ratio/ — tier interpretation.

Correction decision: the arithmetic ratio itself was not reversed; the missing distinction was the classic KGR eligibility rule and the boundary convention. The extended dashboard will show `KGR = allintitle / volume`, `classicEligible = monthly volume < 250`, HOT when KGR < 0.25, OK when 0.25 <= KGR < 1, and Too Competitive when KGR >= 1. Exact equality at 0.25 is not HOT.

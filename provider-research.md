# SERP provider free-credit comparison

Research date: 2026-08-16.

## SerpApi
Official pricing: https://serpapi.com/pricing

SerpApi currently lists a $0 Free plan with 250 searches per month and 50 searches per hour. It is the strongest candidate for this project because its Google Search API is documented to expose a `search_information.total_results` field for Google searches, which corresponds to the result-count metadata needed by KGR. The free tier is limited but sufficient for integration testing and a small keyword batch.

## ScrapingBee
Official Google Search API page: https://www.scrapingbee.com/features/google/

ScrapingBee advertises 1,000 free API credits with no credit card required. Its example response includes `meta_data.number_of_results`. This appears suitable for exact total-results extraction, subject to verifying that the field is returned for an `allintitle:` query in the chosen plan and that the endpoint’s response matches the desired Google About-results semantics.

## DataForSEO
Official trial guidance: https://dataforseo.com/help-center/how-does-your-free-unlimited-trial-work

DataForSEO provides $1 free credit upon registration. The page says this is enough for approximately 833 high-priority SERP requests. It is suitable for testing, but the account/API workflow is more involved and the free credit is a one-time trial balance.

## Scrapingdog
Reference page: https://www.scrapingdog.com/blog/best-serp-apis/

The provider comparison page advertises 1,000 free credits for testing. It should be validated against current official API documentation before integration because the cited page is a comparison article and not the primary pricing contract.

## Recommendation
Use SerpApi first for this KGR project: it has a clearly documented free monthly tier and a known `search_information.total_results` response field. ScrapingBee is the best alternative if 1,000 no-card credits are more important than minimal integration scope. Any chosen provider must be tested with the exact USA query `allintitle:keyword phrase` and the returned count must be verified before computing KGR.

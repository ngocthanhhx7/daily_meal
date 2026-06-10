# Báo cáo đo lường Daily Meal

Ngày đo: 10/06/2026, Asia/Saigon  
Phạm vi: production web/PWA tại `https://dailymeal.site/` và production API tại `https://api.dailymeal.site/`

## Tóm tắt

Daily Meal production reachable trong cửa sổ đo ngày 10/06/2026. Web shell trả `200 OK`, API health/public plans/auth/feed/notifications đều thành công trong 10/10 request mẫu, error rate 0% cho các endpoint đã đo. Nhóm technical metrics đã có baseline đủ dùng cho web/API timing, Lighthouse synthetic, cache header và kích thước bundle/static asset.

Điểm rủi ro lớn nhất là hiệu năng web trên Lighthouse mobile synthetic: Performance 50, LCP khoảng 8.8 giây và TBT 952 ms. Main JavaScript bundle khoảng 1.87 MB raw, khoảng 518 KiB compressed transfer; một số image/font/favicon asset cũng lớn.

Các nhóm product behaviour, traffic/growth, conversion và crash/runtime stability mới chỉ được đánh giá ở mức data availability. Không có bằng chứng trong vòng đo này để claim session duration, scroll depth, DAU/WAU/MAU, returning users, bounce rate, CTR, creator conversion hay crash-free sessions.

## Data availability

| Nhóm theo metric list | Trạng thái | Có trong báo cáo | Thiếu/chưa đủ |
| --- | --- | --- | --- |
| Technical metrics | Measured | Web timing, API timing, Lighthouse, cache, bundle/static asset size | Cần multi-run Lighthouse median định kỳ và RUM/Core Web Vitals thực tế |
| User/product behaviour | Unavailable | Mô tả hành vi sản phẩm và các event cần đo | Session duration, feed scroll depth, impressions, saves, comments, shares, content creation events |
| Traffic/growth | Unavailable | Không có số liệu production analytics đáng tin cậy trong vòng đo | DAU, WAU, MAU, new users, returning users, source/referrer, retention |
| Conversion | Unavailable | Chỉ xác định funnel cần đo | Lurker-to-creator, signup-to-post, premium plan view-to-purchase, payment success rate theo cohort |
| Crash/runtime stability | Partially measured | API endpoint success/error trong synthetic probes | Client crash rate, unhandled runtime errors, crash-free sessions, server error budget theo log/APM |
| Raw evidence | Measured | Bảng số đo web/API/Lighthouse/raw asset bên dưới | Cần lưu artifact JSON tự động cho từng lần chạy |

## Product behaviour

Trạng thái: Unavailable

Daily Meal là ứng dụng mạng xã hội hình ảnh về đồ ăn, có feed bài viết, profile, bình luận, công thức, thông báo, premium/payment, chat và luồng tạo bài viết có ảnh. Với sản phẩm image-first, các hành vi quan trọng nên được đo gồm:

| Behaviour metric | Trạng thái | Ghi chú |
| --- | --- | --- |
| Session duration | Unavailable | Cần analytics session hoặc event heartbeat |
| Feed scroll depth | Unavailable | Cần impression event theo post/item depth |
| Content engagement | Unavailable | Cần event cho like, comment, save, share, recipe view |
| Creator activity | Unavailable | Cần event create post, upload image, publish success/failure |
| Returning behaviour | Unavailable | Cần user/session cohort theo ngày/tuần |

Không nên đưa kết luận về engagement hoặc retention cho đến khi có event tracking hoặc analytics export.

## Traffic/growth

Trạng thái: Unavailable

Trong vòng đo này không có nguồn dữ liệu traffic/growth. Báo cáo không claim DAU/WAU/MAU, user acquisition, source/referrer, bounce rate hoặc returning user rate.

| Growth metric | Trạng thái | Nguồn dữ liệu cần có |
| --- | --- | --- |
| DAU/WAU/MAU | Unavailable | Analytics export hoặc activity query từ database |
| New vs returning users | Unavailable | User/session analytics |
| Traffic source/referrer | Unavailable | Web analytics hoặc CDN/log pipeline |
| Retention cohort | Unavailable | Event stream gắn user id ẩn danh |

## Conversion

Trạng thái: Unavailable

Các funnel conversion hợp lý cho Daily Meal nhưng chưa có số đo trong báo cáo này:

| Funnel | Trạng thái | Event tối thiểu cần đo |
| --- | --- | --- |
| Visitor to signup | Unavailable | visit, signup_start, signup_success |
| Lurker to creator | Unavailable | feed_view, create_post_start, post_publish_success |
| Plan view to premium purchase | Unavailable | premium_plan_view, checkout_start, payment_success, payment_failed |
| Recipe/content view to engagement | Unavailable | recipe_view, save, comment, share |

## Crash/runtime stability

Trạng thái: Partially measured

Synthetic API probes cho thấy các endpoint đã đo đều trả thành công trong sample window. Tuy nhiên, kết quả này không thay thế crash reporting hoặc runtime monitoring trên client/server.

| Stability metric | Trạng thái | Kết quả |
| --- | --- | --- |
| API synthetic error rate | Measured | 0% error trên các endpoint đã đo, 10 attempts mỗi endpoint |
| API tail latency | Measured | Notifications p95 1,476 ms, feed p95 1,009 ms cần theo dõi |
| Client crash-free sessions | Unavailable | Cần Sentry/Firebase Crashlytics/Expo errors hoặc tương đương |
| JS runtime errors | Unavailable | Cần client error reporting |
| Server production exception rate | Unavailable | Cần log/APM/error budget theo thời gian |

## Technical metrics

Trạng thái: Measured

### Web shell

| Metric | Result | Target/reading | Trạng thái |
| --- | ---: | --- | --- |
| Root status | 200 OK | 200 | Measured |
| Root HTML size | 1,177 bytes | Nhỏ | Measured |
| Root compressed transfer | 619 bytes | Nhỏ | Measured |
| Root 10-sample avg | 137.1 ms | < 500 ms | Measured |
| Root 10-sample p95 | 266 ms | < 500 ms | Measured |
| Direct curl TTFB | 193.635 ms | < 500 ms | Measured |
| Direct curl total | 193.750 ms | < 500 ms | Measured |
| HTML cache | `Cache-Control: no-store`, `Cf-Cache-Status: DYNAMIC` | Hợp lý nếu app shell chủ đích no-store | Measured |

### Static assets and bundle

| Asset/metric | Result | Reading | Trạng thái |
| --- | ---: | --- | --- |
| Main JS resource size | 1,871,837 bytes | Large initial app bundle | Measured |
| Main JS compressed transfer | 518,460 bytes via curl, 524,710 bytes via Lighthouse | Needs improvement | Measured |
| JS cache | `public, max-age=2592000, immutable`, Cloudflare HIT | Good cache behaviour | Measured |
| Background PNG transfer | 437,059 bytes | Large image asset | Measured |
| Ionicons TTF transfer | 206,846 bytes | Large font asset | Measured |
| favicon PNG transfer | 171,641 bytes | Large favicon asset | Measured |
| favicon.ico transfer | 162,049 bytes | Large favicon asset | Measured |
| WorkSans Bold TTF transfer | 106,347 bytes | Font payload | Measured |
| WorkSans Medium TTF transfer | 104,700 bytes | Font payload | Measured |

### Lighthouse synthetic

Lighthouse là một lần chạy mobile/headless trong số liệu gốc này, chưa phải median nhiều lần.

| Metric | Result | Target/reading | Trạng thái |
| --- | ---: | --- | --- |
| Performance | 50 | >= 80 | Measured, needs improvement |
| Accessibility | 94 | >= 90 | Measured |
| Best Practices | 96 | >= 90 | Measured |
| SEO | 83 | >= 90 | Measured, watch |
| First Contentful Paint | 802.071 ms | <= 1,800 ms good | Measured |
| Largest Contentful Paint | 8,755.187 ms | <= 2,500 ms good, <= 4,000 ms needs improvement | Measured, poor |
| Total Blocking Time | 952 ms | <= 200 ms good | Measured, poor |
| Cumulative Layout Shift | 0.0097 | <= 0.1 good | Measured |
| Speed Index | 5,359.217 ms | Lower is better | Measured |
| Time to Interactive | 10,147.063 ms | Lower is better | Measured |
| Total byte weight | 1,935,317 bytes | Lower is better | Measured |
| Network requests | 14 | Lower critical path is better | Measured |

### API timing

| Endpoint | Attempts | Success | Error rate | Min | Avg | P95 | Max | Statuses | Item count | Trạng thái |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `POST /api/auth/login` | 10 | 10 | 0% | 569 ms | 643.9 ms | 799 ms | 799 ms | 200 | N/A | Measured |
| `GET /health` | 10 | 10 | 0% | 81 ms | 84.7 ms | 89 ms | 89 ms | 200 | N/A | Measured |
| `GET /api/auth/me` | 10 | 10 | 0% | 96 ms | 172.9 ms | 704 ms | 704 ms | 200 | N/A | Measured, watch |
| `GET /api/posts/feed` | 10 | 10 | 0% | 111 ms | 211.2 ms | 1,009 ms | 1,009 ms | 200 | 20 posts | Measured, watch |
| `GET /api/notifications` | 10 | 10 | 0% | 97 ms | 271.4 ms | 1,476 ms | 1,476 ms | 200 | 22 notifications | Measured, needs investigation |
| `GET /api/payments/premium/plans` | 10 | 10 | 0% | 91 ms | 100.1 ms | 133 ms | 133 ms | 200 | 3 plans | Measured |

## Raw evidence

Trạng thái: Measured for web/API/Lighthouse values, Unavailable for product analytics.

| Evidence | Value |
| --- | --- |
| Measurement date | 10/06/2026 |
| API sample timestamp | 2026-06-10 21:32:51 Asia/Saigon |
| Web/Lighthouse sample timestamp | 2026-06-10 21:30-21:31 Asia/Saigon |
| Machine/runtime | Local Windows machine, Node.js v25.8.1, timezone Asia/Saigon |
| Target web | `https://dailymeal.site/` |
| Target API | `https://api.dailymeal.site/` |
| API sample size | 10 attempts per endpoint |
| Web sample size | 10 GET attempts and one curl-style header/timing check |
| Lighthouse sample size | 1 mobile/headless run in original evidence |
| Test credentials | Owner-provided test account; password/token/cookie intentionally not recorded |
| PowerShell note | `Invoke-WebRequest -Method Head` hit a local null-reference error, so final header evidence used GET/curl-style checks |

Raw measurement values are preserved in the tables above. Repeatable scripts have been added so future runs can write a fresh generated report without copying tokens into the output.

## Next actions

| Priority | Action | Metric group | Expected result |
| --- | --- | --- | --- |
| P0 | Run `npm run measurement:scan` before publishing docs | Encoding/reporting | Prevent mojibake regressions while allowing valid Vietnamese Markdown |
| P0 | Run `npm run measurement:report -- --runs 10 --lighthouse-runs 3 --output docs/daily-meal-measurement-latest.md` from a machine with Chrome/Lighthouse | Technical metrics | Repeatable web/API timing, static asset summary and Lighthouse median |
| P1 | Reduce initial web payload: split bundle where practical, audit image/favicon sizes, review font loading | Technical metrics | Improve LCP/TBT and Lighthouse Performance |
| P1 | Add product analytics events for feed impressions, scroll depth, likes/comments/saves/shares, create-post start/success/failure | User behaviour | Make engagement and creator activity measurable |
| P1 | Add traffic dashboard or export for DAU/WAU/MAU, new/returning users and source/referrer | Traffic/growth | Establish growth baseline |
| P1 | Add premium/payment funnel events with sanitized IDs only | Conversion | Measure plan view to checkout/payment success |
| P1 | Add client/runtime error reporting and server error aggregation | Crash/runtime stability | Measure crash-free sessions and production exception rate |
| P2 | Store generated measurement artifacts under docs or CI artifacts with timestamped filenames | Raw evidence | Make trend comparisons reproducible |

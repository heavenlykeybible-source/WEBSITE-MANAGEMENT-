(()=>{
'use strict';
window.HKCommunitySmoke=window.HKCommunitySmoke||{};
window.HKCommunitySmoke.endlessFeed=()=>{
 const stream=document.querySelector('.social-stream');
 const sentinel=stream?.querySelector('.feed-continuation-sentinel');
 const feed=stream?.querySelector('[data-feed]');
 const more=stream?.querySelector('[data-load-more]');
 return {
  stream:Boolean(stream),
  sentinel:Boolean(sentinel),
  feed:Boolean(feed),
  paginationControl:Boolean(more),
  sentinelState:sentinel?.dataset.feedState||null,
  postCount:feed?.querySelectorAll('[data-post-id]').length||0
 };
};
})();

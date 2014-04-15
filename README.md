meteor-publish
==============

&lt;alpha> Meteor server side publishing with joins.

### Examples

```javascript
Meteor.publish('feed-content', function (slug) {
  // return from a publish function just like a cursor
  return Publisher(FeedContents, FeedContents.find(selector)).join([
      {
        collection: Contents,
        pk: 'type_id',
        fk: '_id',
        findOptions: {
          sort: {publish_at: -1}
        },
        relations: [
          new SecureUrlPublisherForFeed(feedContentSlug)
        ]
      },
      {
        collection: Comments,
        fk: 'type_id',
        find: {type: 'FeedContent'}
      },
      {
        collection: Notifications,
        fk: 'notifiable_id',
        find: {notifiable_type: 'FeedContent', user_id: userId}
      }
    ]);
});
```

```javascript
Meteor.publish('feed-content', function (slug) {
  // call the publish method manually
  Publisher(FeedContents, FeedContents.find(selector)).join([
      {
        collection: Comments,
        fk: 'type_id',
        find: {type: 'FeedContent'}
      }
    ]).publish(this);
});
```

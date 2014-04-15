//XXX implement remove query and remove
ParentQueries = function (relation) {
  this.relation = relation;
};

ParentQueries.prototype = {
  find: function () {
    return this.relation.cursor;
  },

  findChildren: function (id) {
    return null;
  }
};

JoinQueries = function (relation, options) {
  this.relation = relation;
  this.collection = relation.collection;
  this.options = options || {};
};

JoinQueries.prototype = {
  find: function () {
    var sel = this.options.find || {};
    var opts = this.options.findOptions || {};
    var pk = this.options.pk || '_id';
    var fk = this.options.fk;
    if (!fk)
      throw new Error('You forgot to specify a fk option in the join');

    sel[fk] = {$in: this.relation.parent.getKeys(pk)};
    return this.collection.find(sel, opts);
  },

  findChildren: function (id) {
    var sel = this.options.find || {};
    var opts = this.options.findOptions || {};
    var pk = this.options.pk || '_id';
    var fk = this.options.fk;
    if (!fk)
      throw new Error('You forgot to specify a fk option in the join');

    var pkValue = this.relation.parent.keys[id][pk];
    sel[fk] = pkValue;
    return this.collection.find(sel, opts);
  }
};

Publisher = function (collection, cursorOrOptions, QueriesCtor) {
  if (!(this instanceof Publisher))
    return new Publisher(collection, cursorOrOptions, QueriesCtor);

  if (arguments.length < 2 || !_.isObject(cursorOrOptions))
    throw new Error('Publisher requires second parameter to be options or a cursor');

  if (typeof collection !== 'object') {
    throw new Error('Publisher requires a collection as the first parameter');
  }

  if (cursorOrOptions._publishCursor) {
    this.cursor = cursorOrOptions;
    this.options = {};
  } else {
    this.options = cursorOrOptions;
  }

  this.collection = collection;
  this.handle = null;
  this.keys = {};
  this._relations = [];
  this.initial = true;

  this._processJoins(this.options.joins);
  this._processRelations(this.options.relations);

  QueriesCtor = QueriesCtor || ParentQueries;
  this.queries = new QueriesCtor(this, this.options);
};

Publisher.prototype = {
  getKeys: function (field) {
    return _.pluck(this.keys, field);
  },

  join: function (joinOptions) {
    if (!_.isArray(joinOptions))
      joinOptions = [joinOptions];

    this._processJoins(joinOptions);
    return this;
  },

  relations: function (options) {
    this._processRelations([options]);
    return this;
  },

  publish: function (sub) {
    var self = this;
    this.stop();
    this.handle = this.queries.find().observeChanges({
      added: function (id, fields) {
        sub.added(self.collection._name, id, fields);
        self.keys[id] = _.extend(fields, {_id: id});
        if (!self.initial) {
          self.publishRelations(sub);
        }
      },
      changed: function (id, fields) {
        sub.changed(self.collection._name, id, fields);
        self.changeRelations(sub, id, fields);
      },
      removed: function (id) {
        sub.removed(self.collection._name, id);
        self.removeRelations(sub, id);
        delete self.keys[id];
      }
    });

    sub.onStop(function() { self.stop(); });

    this.publishRelations(sub);
    this.initial = false;
    return this;
  },

  changed: function (sub, id, fields) {
    // no op but custom publishers can implement this
  },

  removeAll: function (sub) {
    var self = this;
    _.each(this.keys, function (doc, id) {
      sub.removed(self.collection._name, id);
      self.removeRelations(sub, id);
    });
  },

  //XXX this should really be called directly from publish?
  removed: function (sub, id) {
    var self = this;

    var cursor = this.queries.findChildren(id);
    if (cursor) {
      cursor.forEach(function (doc) {
        self.removeRelations(sub, doc._id);
        sub.removed(self.collection._name, doc._id);
      });
    }
  },

  stop: function () {
    if (this.handle) {
      this.handle.stop();
    }

    return this;
  },

  publishRelations: function (sub) {
    _.each(this._relations, function (rel) {
      rel.publish(sub);
    });
  },

  changeRelations: function (sub, id, fields) {
    _.each(this._relations, function (rel) {
      rel.changed(sub, id, fields);
    });
  },

  removeRelations: function (sub, primaryKey) {
    _.each(this._relations, function (rel) {
      rel.removed(sub, primaryKey);
    });
  },

  _publishCursor: function (sub) {
    return this.publish(sub);
  },

  _processJoins: function (joins) {
    var self = this;
    _.each(joins, function (options) {
      var join = new Publisher(options.collection, options, JoinQueries);
      join.parent = self;
      self._relations.push(join);
    });
  },

  _processRelations: function (relations) {
    var self = this;
    _.each(relations, function (publisherObj) {
      publisherObj.parent = self;
      self._relations.push(publisherObj);
    });
  }
};

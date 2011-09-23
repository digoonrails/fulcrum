var ProjectView = Backbone.View.extend({

  initialize: function() {
    _.bindAll(this, 'addStory', 'addAll', 'render');

    this.model.stories.bind('add', this.addStory);
    this.model.stories.bind('reset', this.addAll);
    this.model.stories.bind('all', this.render);

    this.model.stories.fetch();
  },

  addStory: function(story, column) {
    // If column is blank determine it from the story.  When the add event
    // is bound on a collection, the callback sends the collection as the
    // second argument, so also check that column is a string and not an
    // object for those cases.
    if (typeof column === 'undefined' || typeof column !== 'string') {
      column = story.column();
    }
    var view = new StoryView({model: story});
    $(column).append(view.render().el);
  },

  addIteration: function(iteration) {
    // FIXME Make a model method
    var iteration_date = this.model.getDateForIterationNumber(iteration.get('number'));
    var points_markup = '<span class="points">' + iteration.points() + ' points</span>';
    var that = this;
    var column = iteration.get('column');
    $(column).append('<div class="iteration">' + iteration.get('number') + ' - ' + iteration_date.toDateString() + points_markup + '</div>');
    _.each(iteration.get('stories'), function(story) {
      that.addStory(story, column);
    });
  },

  addAll: function() {
    $('#done').html("");
    $('#in_progress').html("");
    $('#backlog').html("");
    $('#chilly_bin').html("");

    //
    // Done column
    //
    var that = this;
    var done_iterations = _.groupBy(this.model.stories.column('#done'),
                                    function(story) {
                                      return story.iterationNumber();
                                    });

    // Clear the project iterations
    this.model.iterations = [];

    // There will sometimes be gaps in the done iterations, i.e. no work
    // may have been accepted in a given iteration, and it will therefore
    // not appear in the set.  Store this to iterate over those gaps and
    // insert empty iterations.
    var last_iteration = new Iteration({'number': 0});

    _.each(done_iterations, function(stories, iterationNumber) {

      var iteration = new Iteration({
        'number': iterationNumber, 'stories': stories, column: '#done'
      });

      that.model.iterations.push(iteration);

      that.fillInEmptyIterations('#done', last_iteration, iteration);
      last_iteration = iteration;

    });

    // Fill in any remaining empty iterations in the done column
    var currentIteration = new Iteration({
      'number': this.model.currentIterationNumber(),
      'stories': this.model.stories.column('#in_progress'),
      'maximum_points': this.model.velocity(), 'column': '#in_progress'
    });

    this.fillInEmptyIterations('#done', last_iteration, currentIteration);

    this.model.iterations.push(currentIteration);



    //
    // Backlog column
    //
    var backlogIteration = new Iteration({
      'number': currentIteration.get('number') + 1,
      'column': '#backlog', 'maximum_points': this.model.velocity()
    });
    that.model.iterations.push(backlogIteration);

    _.each(this.model.stories.column('#backlog'), function(story) {

      if (currentIteration.canTakeStory(story)) {
        currentIteration.get('stories').push(story);
        return;
      }

      if (!backlogIteration.canTakeStory(story)) {

        var nextNumber = backlogIteration.get('number') + 1 + Math.ceil(backlogIteration.overflowsBy() / that.model.velocity());

        var nextIteration = new Iteration({
          'number': nextNumber, 'column': '#backlog',
          'maximum_points': that.model.velocity()
        });

        // If the iteration overflowed, create enough empty iterations to
        // accommodate the surplus.  For example, if the project velocity
        // is 1, and the last iteration contained 1 5 point story, we'll
        // need 4 empty iterations.
        //
        that.fillInEmptyIterations('#backlog', backlogIteration, nextIteration);

        that.model.iterations.push(nextIteration);
        backlogIteration = nextIteration;
      }

      backlogIteration.get('stories').push(story);
    });


    // Render each iteration
    _.each(this.model.iterations, function(iteration) {
      var column = iteration.get('column');
      that.addIteration(iteration);
    });

    // Render the chilly bin.  This needs to be rendered separately because
    // the stories don't belong to an iteration.
    _.each(this.model.stories.column('#chilly_bin'), function(story) {
      that.addStory(story)
    });
  },

  // Creates a set of empty iterations in column, with iteration numbers
  // starting at start and ending at end
  fillInEmptyIterations: function(column, start, end) {
    var missing_range = _.range(
      parseInt(start.get('number')) + 1,
      parseInt(end.get('number'))
    );
    var that = this;
    return _.map(missing_range, function(missing_iteration_number) {
      var iteration = new Iteration({
        'number': missing_iteration_number, 'column': column
      });
      that.model.iterations.push(iteration);
      return iteration;
    });
  },

  scaleToViewport: function() {
    var storyTableTop = $('table.stories tbody').offset().top;
    // Extra for the bottom padding and the 
    var extra = 100;
    var height = $(window).height() - (storyTableTop + extra);
    $('.storycolumn').css('height', height + 'px');
  },

  notice: function(message) {
    $.gritter.add(message);
  }
});

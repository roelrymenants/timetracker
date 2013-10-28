_.mixin(_.str.exports());

var TimeTracker = TimeTracker || {};

var formatDateTime = function(dateTime) {
	if (!dateTime) {
		return ""
	}

	var localDate = new Date(0);

	localDate.setTime(dateTime.getTime() + dateTime.getTimezoneOffset()*60*1000 - localDate.getTimezoneOffset()*60*1000);

	var brokenDownDate = [_(localDate.getFullYear()).pad(4,"0"),_(localDate.getMonth()+1).pad(2,"0"),_(localDate.getDate()).pad(2,"0")];
	var brokenDownTime = [_(localDate.getHours()).pad(2,"0"), _(localDate.getMinutes()).pad(2,"0")];

	var formattedTime = brokenDownDate.join("-") + "T" + brokenDownTime.join(":");

	return formattedTime;
};

TimeTracker.Tracker = function ($, window) {
	var Export = function() {
		if (window.webkitNotifications) {
			if (window.webkitNotifications.checkPermission() == 0) {
				this.Notifications.hasPermission = true;
			} else {
				this.Notifications.hasPermission = false;
			}
		} else {
			alert('No notification support');
		}
	};

	Export.prototype.timeout = 15*1000; //15s

	Export.prototype.activities = [];
	Export.prototype.Notifications = {
		hasPermission: false
	};

	Export.prototype.Notifications.showNotification = function() {
		if (this.Notifications.hasPermission) {
			var notification = window.webkitNotifications.createNotification(null, 'TimeTracker', 'TimeTracker started');

			if (this.Notifications.clickHandler) {
				notification.onclick = function() {
					this.Notifications.clickHandler(notification);
				}.bind(this);
			}

			notification.show();
		}
	}

	Export.prototype.stopTimer = function() {
		if (this.timer) {
			window.clearInterval(this.timer);
		}
	};

	Export.prototype.startTimer = function() {
		if (!this.timeout) {
			console.error("No callback or timeout defined. Can't start timer.", this);
		}

		if (this.timer) {
			this.stopTimer();
		}

		this.timer = window.setInterval(this.Notifications.showNotification.bind(this), this.timeout);
	};

	Export.prototype.startActivity = function() {};

	Export.prototype.stopActivity = function() {};

	return Export;
}(jQuery, window);

$(document).ready(function() {
	var timeTracker = new TimeTracker.Tracker();

	TimeTracker.Jira = {};

	TimeTracker.Jira.Issue = Backbone.Model.extend({
		parse: function(response) {
			return {worklogs: response.worklogs}
		}
	});

	TimeTracker.Jira.IssueCollection = Backbone.Collection.extend({
		model: TimeTracker.Jira.Issue,
		url: "/json",

		initialize: function() {
			this.listenTo(activityList, "add", this.newActivity);
		},

		newActivity: function(activityModel) {
			this.listenTo(activityModel, "change", this.checkJiraIssue);

			this.checkJiraIssue(activityModel);
		},

		checkJiraIssue: function(activityModel) {
			var existingIssue = this.get(activityModel.name());
			if (!existingIssue) {
				var newIssue = new TimeTracker.Jira.Issue({id: activityModel.name()});
				this.add(newIssue);
				newIssue.fetch({
					error: function(model, response, options) {
						model.set("onServer", false);
						activityModel.trigger("updated:issue", model);
					},
					success: function(model, response, options) {
						model.set("onServer", true);
						activityModel.trigger("updated:issue", model);
					}
				});

			} else {
				activityModel.trigger("updated:issue", existingIssue);
			}
		}
	});

	TimeTracker.Activity = Backbone.Model.extend({
		defaults: {
			startTime: new Date(),
			endTime: null
		},
		worklogs: [],

		initialize: function() {
			this.on("updated:issue", this.processWorklogs, this);
		},

		processWorklogs: function(issueModel) {
			console.log("Updating related issues", issueModel);
			this.relatedIssue = issueModel;

			this.worklogs = [];

			if (!this.relatedIssue || !this.relatedIssue.get("onServer"))
				return;

			_(this.relatedIssue.get("worklogs")).each(function(worklog) {
				var worklogClone = $.extend({}, worklog);

				worklogClone.startTime = new Date(worklogClone.started);
				worklogClone.endTime = new Date(worklogClone.startTime.getTime()+worklogClone.timeSpentSeconds*1000);

				if (!worklogClone.comment) {
					worklogClone.comment = "[No comment provided]";
				}

				console.group("Worklog Starttime");
					console.log(worklogClone.startTime);
					console.log(this.get("startTime"));
					console.log(worklogClone.startTime >= this.get("startTime"));
				console.groupEnd();

				console.group("Worklog Endtime");
					console.log(worklogClone.endTime);
					console.log(this.get("endTime"));
					console.log(worklogClone.endTime <= this.get("endTime"));
				console.groupEnd();

				if (worklogClone.startTime >= this.get("startTime") && worklogClone.endTime <= this.get("endTime")) {
					this.worklogs.push(worklogClone);
				}
			}.bind(this));

			console.info("Worklogs updated");

			this.trigger("updated:worklogs");
		},

		parse: function(attributes) {
			var timezone = (new Date(0)).getTimezoneOffset() / -60; //Timezone in negative seconds

			var timezoneString = "+" + _(timezone).pad(2,"0") + ":00"

			if (attributes.startTime) {
				if (typeof(attributes.startTime) == "string" && !_(attributes.startTime).endsWith("Z")) {
					attributes.startTime += timezoneString
				}

				attributes.startTime = new Date(attributes.startTime);
			}

			if (attributes.endTime) {
				if (typeof(attributes.endTime) == "string" && !_(attributes.endTime).endsWith("Z")) {
					attributes.endTime += timezoneString
				}
				attributes.endTime = new Date(attributes.endTime);
			}

			return attributes;
		},

		validate: function(attributes) {
			var newAttributes = $.extend({}, this.attributes, attributes);
			if (newAttributes.startTime && newAttributes.endTime && newAttributes.startTime > newAttributes.endTime) {
				return {msg: "Start can't be before end", elements: ["startTime", "endTime"]};
			}

			if (!newAttributes.name) {
				return {msg:"Activity must have a name", elements: ["name"]};
			}
		},

		name: function() {
			return this.get("name");
		},
		description: function() {
			return this.get("description");
		},
		startTime: function() {
			return this.get("startTime");
		},
		endTime: function() {
			return this.get("endTime");
		},
		date: function() {
			return this.startTime().toDateString();
		},
		timeSpentSeconds: function() {
			if (this.get("startTime") && this.get("endTime")) {
				return (this.get("endTime").getTime() - this.get("startTime").getTime())/1000;
			} else {
				return 0;
			}
		},

		close: function(endTime) {
			if (!endTime) {
	    		endTime = new Date();
	    	}

			if (! this.get("endTime")) {
	    		this.save({"endTime": endTime});
	    	}
		}
	});

	TimeTracker.ActivityList = Backbone.Collection.extend({
		model: TimeTracker.Activity,
	    localStorage: new Backbone.LocalStorage("TimeTracker.Activities"),
	    comparator: 'startTime',

		initialize: function() {
			this.on("add",this.checkForNewDate,this);
			this.on("reset",this.checkAllDates,this);
		},

		checkForNewDate: function(model) {
			var dateExists = this.find(function(existingModel) { return existingModel.date() == model.date();});

			if (!dateExists) {
				this.trigger("newdate", model.date());
			}
		},

		checkAllDates: function() {
			var lastDate = null;
			this.each(function(model) {
				if (model.date() != lastDate) {
					this.trigger("newdate", model.date());
					lastDate = model.date();
				}
			}.bind(this));
		},

	    addActivity: function(data) {
	    	var model = new (this.model)();

			model.set(model.parse(data));

	    	this.closeLast(model.startTime());

	    	this.add(model);
	    	model.save();
	    },

	    closeLast: function(endTime) {
    		var lastModel = this.last();

			if (lastModel) {
				lastModel.close(endTime);
			}
	    },

		exportToCsv: function() {
			var csv = [];

			csv.push("Start time; End time; Name");

			this.each(function(activity) {
				var activityArray = [];
				activityArray.push(activity.get("startTime").toISOString());
				activityArray.push(activity.get("endTime")?activity.get("endTime").toISOString():"");
				activityArray.push(activity.get("name"));
				activityArray.push(activity.get("description"));

				csv.push(activityArray.join(";"));
			});

			return csv.join("\n");
		},

		importFromCsv: function(csvText) {
			var csv = csvText.split("\n");

			csv.shift(); //Assume first line are labels
			_(csv).each(function(line) {
				var activityArray = line.split(";");

				var activity = {
					"startTime": activityArray.shift(),
					"endTime": activityArray.shift(),
					"name": activityArray.shift(),
					"description": activityArray.shift()
				};

				if (!activity.endTime) {
					delete activity.endTime;
				}

				this.addActivity(activity);
			}.bind(this));
		}
	});

	TimeTracker.ActivityView = Backbone.View.extend({
		tagName: "li",
		className: "list-group-item row activity",

		template: _.template($("#activity-list-item").html()),

		events: {
			"click .delete": "deleteItem",
			"click .value-component": "enableEdit",
			"click .save": "editAllValues",
			"click .resume": "resume",
			"click .stop": "stop",
			"click .push": "push"
		},

		initialize: function() {
   			this.listenTo(this.model, 'change', this.render);
   			this.listenTo(this.model, 'destroy', this.remove);
			this.listenTo(this.model, 'invalid', this.invalidate);
			this.listenTo(this.model, 'sync', this.render);
			this.listenTo(this.model, 'change:startTime', activityList.sort.bind(activityList));

			this.listenTo(this.model, 'updated:worklogs', this.render);

			this.jiraModel = issueCollection.get(this.model.name());
		},

		render: function() {
			console.debug("Rendering activity view", this.model);

			this.$el.html(this.template({model: this.model}));
			this.$el.removeClass();
			this.$el.addClass(this.className);

			return this;
		},

		enableEdit: function(event) {
			var $target = $(event.currentTarget);
			var relatedInputName = $target.attr("data-name");
			var $relatedInput = this.$el.find("input[name='" + relatedInputName + "']");

			this.$el.addClass("editable");

			$relatedInput.focus();
		},

		editAllValues: function() {
			var newAttributes = {
				startTime: this.$el.find("input[name='startTime']").val(),
				endTime: this.$el.find("input[name='endTime']").val(),
				name: this.$el.find("input[name='name']").val(),
				description: this.$el.find("input[name='description']").val()
			};

			var isValid = this.model.save(this.model.parse(newAttributes));
		},

		invalidate: function() {
			_(this.model.validationError.elements).each(function(fieldName) {
				this.$el.find("input[name='" + fieldName  + "']").siblings(".help-block").text(this.model.validationError.msg);
			}.bind(this));

			this.$el.addClass("has-error");
		},

		resume: function() {
			activityList.addActivity({name: this.model.name()});
		},

		deleteItem: function() {
			this.model.destroy();
		},

		stop: function() {
			this.model.close();
		},

		push: function() {
			if (this.model.get("startTime") && this.model.get("endTime")) {
				var timeSpentSeconds = this.model.get("endTime").getTime() - this.model.get("startTime").getTime();

				var json = {
					"comment": this.model.get("name"),
					"started": this.model.get("startTime").toISOString(),
					"timeSpentSeconds": timeSpentSeconds
				};
				//TODO
			}
		}
	});

	var activityList = new TimeTracker.ActivityList();
	var issueCollection = new TimeTracker.Jira.IssueCollection();

	TimeTracker.TypeAheadView = Backbone.View.extend({
		el: $("#activity"),

		initialize: function() {
			this.listenTo(activityList, 'all', this.render);
		},

		render: function() {
			var uniqueList = _.map(this.collection.groupBy("name"),function(item, index) {return index;}) || [];

			this.$el.typeahead('destroy');
			this.$el.typeahead({
				local: uniqueList
			});
		}
	});

	TimeTracker.AddActivityView = Backbone.View.extend({
		el: $(".change"),

		events: {
			"click #start-activity": "createActivity",
			"keypress #activity": "createActivityOnEnter",
			"shown.bs.modal": "focusActivity"
		},

		initialize: function() {
		},

		createActivity: function() {
			this.collection.addActivity({name: $("#activity").val()});
			$("#activity").val("");

			this.$el.modal('hide');
		},

		focusActivity: function() {
			$("#activity").focus();
		},

		createActivityOnEnter: function(event) {
			if (event.which == 13) { //enter
				this.createActivity();
			}
		}
	});

	TimeTracker.DayView = Backbone.View.extend({
		tagName: "div",
		className: "panel panel-default",

		template: _.template($("#activity-group").html()),

		initialize: function(options) {
			this.date = options.date;

			this.listenTo(this.collection, 'add', this.addOne);
			this.listenTo(this.collection, 'reset', this.addAll);
			this.listenTo(this.collection, 'sort', this.addAll);
		},

		render: function() {
			this.$el.html(this.template({date: this.date}));
			this.$el.removeClass();
			this.$el.addClass(this.className);

			this.$list = this.$el.find(".activity-list");
			this.$sumListElement = this.$el.find(".sum-list");

			this.addAll();

			if (this.sumView) {
				this.sumView.remove();
			}

			this.sumView = new TimeTracker.SumView({collection: activityList});
			this.$sumListElement.append(this.sumView.render().el);

			return this;
		},

		addOne: function(model) {
			var view = new TimeTracker.ActivityView({model: model});

			this.$list.append(view.render().el);
		},

		addAll: function() {
			this.$el.remove(".activity");

			var onThisDay = this.collection.filter(function(model) {
				return (model.date() == this.date);
			}.bind(this));

			_(onThisDay).each(function(model) {
				this.addOne(model);
			}.bind(this));
		}
	});

	TimeTracker.SumView = Backbone.View.extend({
		tagName: "li",
		className: "list-group-item row sum",

		template: _.template($("#activity-sum").html()),

		initialize: function() {
   			this.listenTo(this.collection, 'add reset sort', this.render);
		},

		render: function() {
			this.$el.html(this.template({activities: this.collection}));
			this.$el.removeClass();
			this.$el.addClass(this.className);

			return this;
		}
	});

	TimeTracker.App = Backbone.View.extend({
		el: $("body"),

		events: {
			"click [data-action='export']": "export",
			"click [data-action='import']": "import"
		},

		initialize: function() {
			this.$mainView = $(".main-view");

			this.listenTo(activityList, 'add', this.addOne);
			this.listenTo(activityList, 'reset', this.addAll);
			this.listenTo(activityList, 'sort', this.addAll);

			this.listenTo(activityList, 'newdate', this.addDate);

			$(window).on("unload", this.closeLast);

			this.typeahead = new TimeTracker.TypeAheadView({collection: activityList});

			this.addActivityDialog = new TimeTracker.AddActivityView({collection: activityList});

			activityList.fetch({reset:true});
		},

		addDate: function(date) {
			var dateView = new TimeTracker.DayView({date: date, collection: activityList});

			this.$mainView.append(dateView.render().el);
		},

		closeLast: function() {
			activityList.closeLast();
		},

		export: function() {
			window.open('data:application/octet-stream;charset=utf-8,' + encodeURIComponent(activityList.exportToCsv()));
		},

		import: function() {
			var csv = $(".import [name='csv']").val();

			if (csv) {
				activityList.importFromCsv(csv);
			}

			$(".import [name='csv']").val("");

			$(".import").modal('hide');
		}
	});

	var app = new TimeTracker.App();

	timeTracker.Notifications.clickHandler = function(notification) {
		notification.close();

    	$(".change").modal('show');
    };

	if (window.webkitNotifications) {
		if (timeTracker.Notifications.hasPermission) {
			$(".notifications-enabled").removeClass("hidden");
		} else {
			$(".notifications-disabled, .button-enable").removeClass("hidden");
			$(".button-enable").click(function() {
				window.webkitNotifications.requestPermission();
			});
		}
	} else {
		alert('No notification support');
	}
	//timeTracker.startTimer();
});

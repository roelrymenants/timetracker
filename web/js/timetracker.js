var TimeTracker = function ($, window) {
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
	timeTracker = new TimeTracker();

	timeTracker.Notifications.clickHandler = function(notification) {
		notification.close();

    	$(".change").modal('show');
    };

	$("#activity").typeahead({
		name: 'activities',
		local: timeTracker.activities
	});

	$("#start-activity").click(function() {
		timeTracker.activities.push($("#activity").val());

		$(".activity-list").find(".list-group-item.instance").remove();

		var activityIndex = 0;
		for (activityIndex in timeTracker.activities) {
			var currentActivity = timeTracker.activities[activityIndex];
			var newItem = $(".activity-list").find(".list-group-item.template").clone();
			newItem.removeClass("template hidden").addClass("instance").text(currentActivity).appendTo($(".activity-list"));
		}

		$(".change").modal('hide');
	});

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

	timeTracker.startTimer();
});
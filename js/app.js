/*global jQuery, Handlebars */
jQuery(function ($) {
    'use strict';

    $.ajaxPrefilter(function (options, originalOptions, xhr) {
        if (appConfig.backendID) {
            xhr.setRequestHeader('Enginio-Backend-Id', appConfig.backendID);
        }

        if (appConfig.backendSecret) {
            xhr.setRequestHeader('Enginio-Backend-Secret', appConfig.backendSecret);
        }

        xhr.setRequestHeader('Content-Type', 'application/json');
    });

    $(document).ajaxError(function (exception, jqXHR, options) {
        if (jqXHR.status === 0) {
            alert('No network connectivity.');
        } else if (exception === 'timeout') {
            alert('Request timed out.');
        } else if (exception === 'abort') {
            alert('Ajax request aborted.');
        } else {
            alert('HTTP status code:' + jqXHR.status + '\n Error info:' + jqXHR.responseText);
        }
    });

    var Utils = {
        pluralize:function (count, word) {
            return count === 1 ? word : word + 's';
        }
    };

    var App = {
        init:function () {
            this.ENTER_KEY = 13;
            this.todos = [];
            this.listTodoItemsFromEnginio();
            this.cacheElements();
            this.bindEvents();
            this.render();
        },

        cacheElements:function () {
            this.todoTemplate = Handlebars.compile($('#todo-template').html());
            this.footerTemplate = Handlebars.compile($('#footer-template').html());
            this.$todoApp = $('#todoapp');
            this.$newTodo = $('#new-todo');
            this.$toggleAll = $('#toggle-all');
            this.$main = $('#main');
            this.$todoList = $('#todo-list');
            this.$footer = this.$todoApp.find('#footer');
            this.$count = $('#todo-count');
            this.$clearBtn = $('#clear-completed');
        },

        bindEvents:function () {
            var list = this.$todoList;
            this.$newTodo.on('keyup', this.cmdCreate);
            this.$toggleAll.on('change', this.cmdToggleAll);
            this.$footer.on('click', '#clear-completed', this.cmdDestroyAllCompleted);
            list.on('change', '.toggle', this.cmdToggle);
            list.on('dblclick', 'label', this.cmdEdit);
            list.on('keypress', '.edit', this.blurOnEnter);
            list.on('blur', '.edit', this.cmdUpdate);
            list.on('click', '.destroy', this.cmdDestroy);
        },

        render:function () {
            this.$todoList.html(this.todoTemplate(this.todos));
            this.$main.toggle(!!this.todos.length);
            this.$toggleAll.prop('checked', !this.activeTodoCount());
            this.renderFooter();
        },

        renderFooter:function () {
            var todoCount = this.todos.length,
                activeTodoCount = this.activeTodoCount(),
                footer = {
                    activeTodoCount:activeTodoCount,
                    activeTodoWord:Utils.pluralize(activeTodoCount, 'item'),
                    completedTodos:todoCount - activeTodoCount
                };

            this.$footer.toggle(!!todoCount);
            this.$footer.html(this.footerTemplate(footer));
        },

        lookupTodoItemForElementAndApply:function (elem, callback) {
            var id = $(elem).closest('li').data('id');
            $.each(this.todos, function (i, val) {
                if (val.id === id) {
                    callback.apply(App, arguments);
                    return false;
                }
            });
        },

        activeTodoCount:function () {
            var count = 0;
            $.each(this.todos, function (i, val) {
                if (!val.completed) {
                    count++;
                }
            });
            return count;
        },

        blurOnEnter:function (e) {
            if (e.keyCode === App.ENTER_KEY) {
                e.target.blur();
            }
        },

        cmdCreate:function (e) {
            var $input = $(this),
                val = $.trim($input.val());
            if (e.which !== App.ENTER_KEY || !val) {
                return;
            }

            var todoItem = {};
            todoItem["title"] = val;
            todoItem["completed"] = false;

            App.createTodoItemToEnginio(todoItem);

            $input.val('');
        },

        cmdToggle:function () {
            App.lookupTodoItemForElementAndApply(this, function (i, todoItem) {
                todoItem.completed = !todoItem.completed;
                App.updateTodoItemToEnginio(todoItem);
                App.render();
            });
        },

        cmdToggleAll:function () {
            var isChecked = $(this).prop('checked');
            $.each(App.todos, function (i, todoItem) {
                todoItem.completed = isChecked;
                App.updateTodoItemToEnginio(todoItem);
            });
            App.render();
        },

        cmdEdit:function () {
            $(this).closest('li').addClass('editing').find('.edit').focus();
        },

        cmdUpdate:function () {
            var val = $.trim($(this).removeClass('editing').val());
            App.lookupTodoItemForElementAndApply(this, function (i) {
                if (val) {
                    this.todos[ i ].title = val;
                    App.updateTodoItemToEnginio(this.todos[ i ]);
                } else {
                    App.deleteTodoItemFromEnginio(this.todos[ i ]);
                    this.todos.splice(i, 1);
                }
                this.render();
            });
        },

        cmdDestroy:function () {
            App.lookupTodoItemForElementAndApply(this, function (i) {
                App.deleteTodoItemFromEnginio(App.todos[ i ]);
                App.todos.splice(i, 1);
                App.render();
            });
        },

        cmdDestroyAllCompleted:function () {
            var todos = App.todos,
                l = todos.length;
            while (l--) {
                if (todos[l].completed) {
                    App.deleteTodoItemFromEnginio(todos[l]);
                    todos.splice(l, 1);
                }
            }
            App.render();
        },

        listTodoItemsFromEnginio:function () {
            $.ajax({type:'GET',
                url:appConfig.backendApiUrl + "/v1/objects/todos",
                dataType:"json",
                contentType:"application/json"
            })
                .success(function (data, textStatus, jqXHR) {
                    App.todos = data.results;
                    App.render();
                })
        },

        createTodoItemToEnginio:function (todoItem) {
            var value = JSON.stringify(todoItem);
            $.ajax({type:'POST',
                url:appConfig.backendApiUrl + "/v1/objects/todos",
                data:value,
                dataType:"json",
                contentType:"application/json"
            })
                .success(function (data, textStatus, jqXHR) {
                    App.todos.push(data);
                    App.render();
                })
        },

        updateTodoItemToEnginio:function (todoItem) {
            var value = JSON.stringify(todoItem);
            $.ajax({type:'PUT',
                url:appConfig.backendApiUrl + "/v1/objects/todos/" + todoItem.id,
                data:value,
                dataType:"json",
                contentType:"application/json"
            })
                .success(function (data, textStatus, jqXHR) {
                })
        },

        deleteTodoItemFromEnginio:function (todoItem) {
            $.ajax({type:'DELETE',
                url:appConfig.backendApiUrl + "/v1/objects/todos/" + todoItem.id,
                dataType:"json",
                contentType:"application/json"
            })
                .success(function (data, textStatus, jqXHR) {
                })
        }
    };

    App.init();
});

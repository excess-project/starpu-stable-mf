/*
 * Copyright 2014, 2015 High Performance Computing Center, Stuttgart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <stdlib.h>
#include <pthread.h>
#include <excess_concurrent_queue.h>

#include "plugin_manager.h"
#include "plugin_discover.h"
#include "excess_main.h"

/**
 * @brief definition of plugin hook
 */
typedef struct PluginHookType_t {
	PluginHook hook;
	const char *name;
} PluginHookType;

/**
 * @brief definition of plugin manager struct
 */
struct PluginManager_t {
	EXCESS_concurrent_queue_t hook_queue;
};

/* Creat a plugin manager, create a hook queue */
PluginManager* PluginManager_new() {
	PluginManager *pm = malloc(sizeof(PluginManager));
	pm->hook_queue = ECQ_create(0);
	return pm;
}

/* Clean-up a plugin manager*/
void PluginManager_free(PluginManager *pm) {
	ECQ_free(pm->hook_queue);
	free(pm);
}

/* Register a plugin hook to the plugin manager 
 * push the hook to the hook queue */
void PluginManager_register_hook(PluginManager *pm, const char *name, PluginHook hook) {
	PluginHookType *hookType = malloc(sizeof(PluginHookType));
	hookType->hook = hook;
	hookType->name = name;

	EXCESS_concurrent_queue_handle_t hook_queue_handle;
	hook_queue_handle =ECQ_get_handle(pm->hook_queue);
	ECQ_enqueue(hook_queue_handle, (void *)hookType);
	ECQ_free_handle(hook_queue_handle);
	pluginCount++;
}

/* Get one hook from the hook queue */
PluginHook PluginManager_get_hook(PluginManager *pm) {
	PluginHook funcPtr = NULL;
	void *retPtr;
	
	EXCESS_concurrent_queue_handle_t hook_queue_handle;
	hook_queue_handle =ECQ_get_handle(pm->hook_queue);
	if(ECQ_try_dequeue(hook_queue_handle, &retPtr)) {
		PluginHookType *typePtr;
		typePtr = (struct PluginHookType_t *) retPtr;
		funcPtr = *(typePtr->hook);
		fprintf(logFile, "using Plugin %s ", typePtr->name);	
	}
	ECQ_free_handle(hook_queue_handle);
	return funcPtr;
}
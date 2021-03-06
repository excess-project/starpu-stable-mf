/*
 * Copyright (C) 2014-2015 University of Stuttgart
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

#include <stdlib.h> /* malloc */

/* monitoring-related includes */
#include "mf_debug.h"
#include "mf_types.h"
#include "publisher.h"
#include "mf_rapl_connector.h"

#define SUCCESS 1
#define FAILURE 0

/*******************************************************************************
 * Variable Declarations
 ******************************************************************************/
/*
 * declares if the plug-in (i.e., RAPL) is already initialized
 */
static int is_initialized = 0;

/*
 * declares if the RAPL component is enabled to be used for monitoring
 *
 * states: (-1) not initialized, (0) disabled, (1) enabled
 */
static int is_available = -1;

int EventSet = PAPI_NULL;
long long before_time, after_time, elapsed_time;
double denominator;
long long *values;
long long *pre_values;

/*******************************************************************************
 * Forward Declarations
 ******************************************************************************/
static int is_rapl_initialized();
static int enable_papi_library();
static double mf_rapl_get_denominator();
static double correct_dram_values(char *event, double value, double pre_value);

/* Checks if RAPL component of the PAPI library is enabled
 * return 1 if component is enabled; 0 otherwise. */
int
mf_rapl_is_enabled()
{
    int numcmp, cid;
    const PAPI_component_info_t *cmpinfo = NULL;
    enable_papi_library();

    if (is_available > -1) {
        return is_available;
    }

    numcmp = PAPI_num_components();
    for (cid = 0; cid < numcmp; cid++) {
        cmpinfo = PAPI_get_component_info(cid);
        if (strstr(cmpinfo->name, "rapl")) {
            if (cmpinfo->disabled) {
                is_available = FAILURE;
                log_warn("Component is DISABLED for this CPU (%d)", cid);
            } else {
                is_available = SUCCESS;
                log_info("Component is ENABLED (%s)", cmpinfo->name);
                /* init rapl units and send to mf_server*/
                mf_rapl_unit_init(cid);
            }
            return is_available;
        }
    }

    is_available = FAILURE;
    return is_available;
}

/* Initialize the units of metrics */
int 
mf_rapl_unit_init(int rapl_cid)
{
    int ret = unit_file_check("rapl");
    if(ret != 0) {
        printf("unit file of rapl exists.\n");
        return FAILURE;
    }
    /* declare variables */
    metric_units *unit = malloc(sizeof(metric_units));
    int r, retval, code, num_events;
    char event_names[MAX_RAPL_EVENTS][PAPI_MAX_STR_LEN];
    char units[MAX_RAPL_EVENTS][PAPI_MIN_STR_LEN];
    PAPI_event_info_t evinfo;

    if (unit == NULL) {
        return FAILURE;
    }
    memset(unit, 0, sizeof(metric_units));

    /* All NATIVE events print units */
    code = PAPI_NATIVE_MASK;
    num_events = 0;

    r = PAPI_enum_cmp_event( &code, PAPI_ENUM_FIRST, rapl_cid );
    while ( r == PAPI_OK ) {
        retval = PAPI_event_code_to_name( code, event_names[num_events] );
        if ( retval != PAPI_OK ) {
            log_error("ERROR: event_code_to_name failed %s", PAPI_strerror(retval));
            return FAILURE;
        }
        retval = PAPI_get_event_info(code, &evinfo);
        if (retval != PAPI_OK) {
            log_error("ERROR: get_event _info failed %s", PAPI_strerror(retval));
            return FAILURE;
        }
        if(strlen(evinfo.units)==0) {
            r = PAPI_enum_cmp_event( &code, PAPI_ENUM_EVENTS, rapl_cid );
            continue;
        }
        unit->metric_name[num_events] =malloc(64 * sizeof(char));
        strcpy(unit->metric_name[num_events], event_names[num_events]+7);
        unit->plugin_name[num_events] =malloc(32 * sizeof(char));
        strcpy(unit->plugin_name[num_events], "mf_plugin_rapl");
        unit->unit[num_events] =malloc(PAPI_MIN_STR_LEN * sizeof(char));
        if(strstr(unit->metric_name[num_events], "ENERGY:") != NULL) {
            strcpy(unit->unit[num_events], "J");
        }
        else {
            strncpy(unit->unit[num_events], evinfo.units, sizeof(units[0])-1);    
        }
        num_events++;
        r = PAPI_enum_cmp_event( &code, PAPI_ENUM_EVENTS, rapl_cid );
     }

     unit->num_metrics = num_events;
     publish_unit(unit);
     return SUCCESS;
}

/* Initialize the RAPL plug-in */
int
mf_rapl_init(RAPL_Plugin *data, char **rapl_events, size_t num_events)
{
    /*
     * setup PAPI library
     */
    if (enable_papi_library() != SUCCESS) {
        return FAILURE;
    }

    /*
     * create PAPI EventSet
     */
    int retval = PAPI_create_eventset(&EventSet);
    if (retval != PAPI_OK) {
        log_error("ERROR: Couldn't create EventSet %s", PAPI_strerror(retval));
        return FAILURE;
    }

    /*
     * add user-defined metrics to the EventSet
     */
    int idx, registered_idx = 0;
    for (idx = 0; idx != num_events; ++idx) {
        retval = PAPI_add_named_event(EventSet, rapl_events[idx]);
        if (retval != PAPI_OK) {
            char *err = PAPI_strerror(retval);
            log_warn("Couldn't add PAPI event (%s): %s", rapl_events[idx], err);
        } else {
            log_info("Added PAPI event %s", rapl_events[idx]);

            /*
             * register added PAPI event at the internal data structure
             */
            data->events[registered_idx] = malloc(PAPI_MAX_STR_LEN + 1);
            strcpy(data->events[registered_idx], rapl_events[idx]);
            registered_idx = registered_idx + 1;
        }
    }
    data->num_events = registered_idx;

    /*
     * set denominator for DRAM values based on the current CPU model
     */
    denominator = mf_rapl_get_denominator();
    values = calloc(registered_idx, sizeof(long long));
    pre_values = calloc(registered_idx, sizeof(long long));
    /*initialize pre_values to 0*/
    for (idx = 0; idx != num_events; ++idx) {
        pre_values[idx]=0;
    }

    /*
     * start monitoring registered events
     */
    before_time = PAPI_get_real_nsec();
    retval = PAPI_start(EventSet);
    if (retval != PAPI_OK) {
        log_error("ERROR: Couldn't start monitoring %s", PAPI_strerror(retval));
        return FAILURE;
    }

    return registered_idx;
}

/* Samples the registered RAPL events */
int
mf_rapl_sample(RAPL_Plugin *data)
{
    /*
     * initialize array to store monitoring results
     */
    size_t size = data->num_events;
    if (values == NULL) {
        log_error("Couldn't initialize long long values %s", "NULL");
        return FAILURE;
    }

    /*
     * read measurements
     */
    after_time = PAPI_get_real_nsec();
    int retval = PAPI_accum(EventSet, values);
    if (retval != PAPI_OK) {
        return FAILURE;
    }

    /*
     * account for time passed between last measurement and now
     */
    int idx;
    elapsed_time = ((double) (after_time - before_time)); //in nano second
    for (idx = 0; idx < size; ++idx) {
        data->values[idx] = correct_dram_values(data->events[idx], values[idx], pre_values[idx]);
        pre_values[idx] = values[idx];
        values[idx] = 0;
    }

    /*
     * update time interval
     */
    before_time = after_time;

    return SUCCESS;
}

/* Conversion of samples data to a JSON document */
char*
mf_rapl_to_json(RAPL_Plugin *data)
{
    char *metric = malloc(METRIC_LENGTH_MAX * sizeof(char));
    char *json = malloc(JSON_LENGTH_MAX * sizeof(char));
    strcpy(json, "\"type\":\"energy\"");

    int idx;
    size_t size = data->num_events;
    for (idx = 0; idx < size; ++idx) {
        sprintf(metric, ",\"%s\":%.4f", data->events[idx], data->values[idx]);
        strcat(json, metric);
        //if metric is energy, send also power value
        char *p = strstr(data->events[idx], "ENERGY");
        if (p != NULL) {
            double power_value = (double) data->values[idx] * 1.0e9 / elapsed_time;
            //nano joule / nano second = watt
            char event[40] = {'\0'};
            strncpy(event, data->events[idx], (p - data->events[idx]));
            strcat(event, "POWER");
            strcat(event, p+6);
            sprintf(metric, ",\"%s\":%.4f", event, power_value);
            strcat(json, metric);
        }
    }
    free(metric);

    return json;
}

/* Adjust the readed value with respect to different coefficients */
static double
correct_dram_values(char *event, double value, double pre_value)
{
    double ret;
    if (strcmp(event, "DRAM_ENERGY:PACKAGE0") == 0 ||
        strcmp(event, "DRAM_ENERGY:PACKAGE1") == 0) {
        ret = (double) (value / denominator);
    }
    if(strstr(event, "ENERGY") != NULL) {
        ret = (double) (value - pre_value) * 1.0e-9; //change from nJ to J
    }
    return ret;
}

/* Initialize PAPI library */
static int
enable_papi_library()
{
    if (is_rapl_initialized()) {
        return is_initialized;
    }

    int retval = PAPI_library_init(PAPI_VER_CURRENT);
    if (retval != PAPI_VER_CURRENT) {
        char *error = PAPI_strerror(retval);
        log_error("ERROR while initializing PAPI library: %s", error);
        is_initialized = FAILURE;
    } else {
        is_initialized = SUCCESS;
    }

    return is_initialized;
}

/* Check if RAPL plugin is initialized */
static int
is_rapl_initialized()
{
    return is_initialized;
}

/* Stop and clean-up the RAPL plugin */
void
mf_rapl_shutdown()
{
    int retval = PAPI_stop(EventSet, NULL);
    if (retval != PAPI_OK) {
        char *error = PAPI_strerror(retval);
        log_error("Couldn't stop PAPI EventSet: %s", error);
    }

    retval = PAPI_cleanup_eventset(EventSet);
    if (retval != PAPI_OK) {
        char *error = PAPI_strerror(retval);
        log_error("Couldn't cleanup PAPI EventSet: %s", error);
    }

    retval = PAPI_destroy_eventset(&EventSet);
    if (retval != PAPI_OK) {
        char *error = PAPI_strerror(retval);
        log_error("Couldn't destroy PAPI EventSet: %s", error);
    }

    PAPI_shutdown();
}

/* Get native cpuid */
void
native_cpuid(
    unsigned int *eax,
    unsigned int *ebx,
    unsigned int *ecx,
    unsigned int *edx)
{
    asm volatile("cpuid"
        : "=a" (*eax),
          "=b" (*ebx),
          "=c" (*ecx),
          "=d" (*edx)
        : "0" (*eax), "2" (*ecx)
    );
}

/* Get CPU model */
static int
mf_rapl_get_cpu_model()
{
    unsigned eax, ebx, ecx, edx;
    eax = 1; /* set processor info and feature bits */
    native_cpuid(&eax, &ebx, &ecx, &edx);
    return (eax >> 4) & 0xF;
}

/* Get the coefficient of current CPU model */
static double
mf_rapl_get_denominator()
{
    int cpu_model = mf_rapl_get_cpu_model();
    if (cpu_model == 15) {
        return 15.3;
    } else {
        return 1.0;
    }
}

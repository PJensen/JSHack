// profiler.js - ECS Performance Profiler
// Keeps profiling logic separate from ECS core to avoid circular dependencies

class Profiler {
    constructor() {
        this.enabled = false;
        this.reset();
    }

    enable(flag) {
        this.enabled = !!flag;
        if (!this.enabled) this.reset();
    }

    reset() {
        this.systemTimings = {};
        this.queryTimings = {};
        this.memoryUsage = {};
    }

    start(label, type = 'system') {
        if (!this.enabled) return;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (type === 'system') {
            this.systemTimings[label] = this.systemTimings[label] || { total: 0, count: 0 };
            this.systemTimings[label]._start = now;
        } else if (type === 'query') {
            this.queryTimings[label] = this.queryTimings[label] || { total: 0, count: 0 };
            this.queryTimings[label]._start = now;
        }
    }

    end(label, type = 'system') {
        if (!this.enabled) return;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        let timings = type === 'system' ? this.systemTimings : this.queryTimings;
        if (timings[label] && timings[label]._start) {
            const elapsed = now - timings[label]._start;
            timings[label].total += elapsed;
            timings[label].count += 1;
            delete timings[label]._start;
        }
    }

    captureMemory() {
        if (!this.enabled) return;
        if (typeof performance !== 'undefined' && performance.memory) {
            this.memoryUsage = {
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                usedJSHeapSize: performance.memory.usedJSHeapSize
            };
        } else if (typeof process !== 'undefined' && process.memoryUsage) {
            this.memoryUsage = process.memoryUsage();
        } else {
            this.memoryUsage = {};
        }
    }

    getStats() {
        // Return a copy to avoid mutation
        return {
            systemTimings: JSON.parse(JSON.stringify(this.systemTimings)),
            queryTimings: JSON.parse(JSON.stringify(this.queryTimings)),
            memoryUsage: { ...this.memoryUsage }
        };
    }
}

export default Profiler;
